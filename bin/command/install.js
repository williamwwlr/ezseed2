var console = require(global.config.root+'/core/logger');
var fs = require('fs')
  , promptly = require('promptly')
  , cache = require('memory-cache')
  , async = require('async')
  ;

var configure = require(global.app_path + '/bin/lib/helpers/configure');
var validators =  require(global.app_path + '/bin/lib/helpers/validators');

/**
 * Main install wrapper
 * @type {Object}
 */
var install = {

	set_config: function(next) {
		console.log('warn', "Le dossier ci-dessous sert à partager les fichiers avec nodejs, si vous n'êtes pas sûr laissez par défaut.");

		promptly.prompt(
			'Chemin des dossiers à parser [/home] :', 

			{validator : validators.path, default: '/home'},

			function(err, path) {

				configure.update_rc(function() {
					configure.set_config(path, next);					
				});
			}
		);
	},
	nginx: function(next) {
		if(cache.get('skipnginx')) {
			console.log('warn', "Skipping nginx configuration");
			next(null, {});
		} else {

			console.log('info', "ex : ./ssl.pem ./ssl.key - séparé par un espace (ou laissez vide pour la générer)");
			promptly.prompt("Entrez une clé SSL :", {validator : validators.ssl, default: ""}, function(err, sslkeys) {
				
				configure.nginx(sslkeys, next);
			});
		}
	},
	torrent: function(next) {

		var choose = function(callback) {

			promptly.choose(

				'Choisissez le client torrent à installer {rutorrent|transmission|[aucun]} : ', 
				['rutorrent', 'transmission', 'aucun'], 
				{default : 'aucun'}, 

				function (err, client) {

					if(cache.get('notorrent') === true) {
						cache.put('client', 'aucun');
						callback(null, 'aucun');
					} else if(client == 'aucun') {

						promptly.confirm(

							"Êtes vous sûr de ne pas vouloir installer de client ? Y/n", 
							{default : 'y'}, 

							function (err, value) {

							    if(value === true) {
							    	
							    	cache.put('client', 'aucun');

							    	require('../client/aucun/install')(callback);
									
								} else
									return choose(callback);

							}
						);

					} else {
				    	cache.put('client', client);

						require('../client/'+client+'/install')(callback);
					}
			});
		}

		if(cache.get('notorrent') === true) {
			cache.put('client', 'aucun');
			next(null);
		} else
			choose(next);
	},
	admin: function(next) {

		if(cache.get('skipuser'))
			next(null, {});
		else {
			console.log('info', "Entrez les informations de l'admin");

			promptly.prompt('Username : ', {validator: validators.user}, function (err, username) {
			    promptly.password('Password : ', function(err, password) {

			    	cache.put('role', 'admin');
			    	
			    	var useradd = require(global.app_path+'/bin/client/'+cache.get('client')+'/useradd');

			    	return useradd(username, password, next);

			    });
			});
		}

	}

}

module.exports = function(program) {

	program
	.command('install [client]')
	.option('-u, --skipuser', 'Skip admin creation')
	.option('-n, --notorrent', 'Skip torrent client installation')
	.option('-s, --skipnginx', 'Skip nginx configuration')
	.description('Install ezseed or the specified client')
	.action(function(client, options) {
		
		if(client) {
			require('../client/'+client+'/install')(function() {
				process.exit();
			});
		} else {

			if(options.notorrent)
				cache.put('notorrent', true);

			if(options.skipnginx)
				cache.put('skipnginx', true);

			if(options.skipuser)
				cache.put('skipuser', true);

			cache.put('isinstall', true);

			async.series(install,
				function (err, results) {

					require('../lib/deploy.js')(function(code) {
						console.log("Fin de l'installation. Lancez ezseed start".info);
						process.exit(0);
					});
				}
			);
		}

	});

};