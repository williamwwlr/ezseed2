var console = require(global.config.root+'/core/logger');
var cache = require('memory-cache')
  , exec = require('child_process').exec
  , _ = require('underscore')
  , fs = require('fs')
  , jf = require('jsonfile');

var configure = {
	update_rc: function(done) {
		console.log('info', "Ajout du script de reboot automatique");
		exec("cp "+global.app_path+"/scripts/ezseed.sh /etc/init.d/ezseed.sh && chmod 755 /etc/init.d/ezseed.sh && update-rc.d ezseed.sh defaults", function(err, stdout, stderr) {
			done(null, {});
		});
	},
	/*
	 * Sets the config.json file
	 */
	set_config: function(path, done) {

		done = typeof path == 'function' ? path : done;
		var replace_symlink = false;

		if(typeof path == 'string') {

			if(path !== global.config.path)
				replace_symlink = true;
				
			console.info('Ecriture du fichier de configuration app/config.json');

			var config = {
					"path": path,
					"fetchTime": 5000,
					"root": global.app_path +'/app',
					"location": "",
					"torrentLink": "embed",
					"transmission":false,
  					"rutorrent":false,
					"theme": "default",
					"scrapper": "allocine"
				};
			
			//replaces existing configuration file
			if(fs.existsSync(global.app_path+'/app/config.json')) {
				var cf = jf.readFileSync(global.app_path + '/app/config.json');

				_.each(config, function(e, i) {
					if(cf[i])
						config[i] = e;
				});
			}

			global.config = config;

			//Writes the config
			jf.writeFileSync(global.app_path + '/app/config.json', config);
		} else {
			path = global.config.path;
		}

		console.log('info', "Paramétrage du lanceur");

		jf.writeFileSync(global.app_path + '/ezseed.json', 

			[{
			    "name"      : "watcher",
			    "script"    : global.app_path + "/app/watcher.js",
			    "error_file": global.app_path + "/logs/watcher-err.log",
			    "out_file"  : global.app_path + "/logs/watcher-out.log",
			    "env": {
			    	"NODE_ENV": "production"
			    }
			},{
			    "name"      : "ezseed",
			    "script"    : global.app_path + "/app/app.js",
			    "error_file": global.app_path + "/logs/ezseed-err.log",
			    "out_file"  : global.app_path + "/logs/ezseed-out.log",
			    "env": {
			    	"NODE_ENV": "production"
			    }
			}]

		);

		console.log('info', "Création d'un lien symbolique de "+path+" sur "+global.app_path+"/app/public/downloads");

		if(!fs.existsSync(global.app_path + '/app/public/downloads') || replace_symlink) {
			
			var next = function(cb) {
				//Symlink on the path
				exec('ln -sf '+ path +' ' + global.app_path + '/app/public/downloads',
				  	function (error, stdout, stderr) {
				  		cache.put('path', path); //?
					    cb(null, {});
					}
				);
			}

			if(replace_symlink) {
				exec('rm '+global.app_path + '/app/public/downloads', function(err, stdout, stderr) {
					
					if(err)
						console.error('Error while removing symlink', err);

					next(done);
				});
			} else
				next(done);
			
		} else {
			console.log('warn', "Le lien symbolique existe");
			done(null, {});
		}
	},
	nginx_copy_config: function(done) {
		//Should be a spawn
		exec("cat "+global.app_path+"/scripts/nginx.conf > /etc/nginx/nginx.conf && service nginx restart", function(error, stdout, stderr) {
			done(null, {});
		});
	},
	/**
	 * Creating keys
	 * @param  {String}   sslkeys [ssl keys array]
	 * @param  {Function} done    [callback]
	 * @return {Function}           [callback]
	 */
	nginx: function(sslkeys, done) {

		var l = sslkeys.length, self = this;

		if(!fs.existsSync('/usr/local/nginx'))
			fs.mkdirSync('/usr/local/nginx', '755');

		//Getting some ssl keys to move in the right directory
		if(l == 2) {	
			var cmd = new Buffer("\
					mv " + sslkeys[0].path + " " + global.app_path + "/ezseed" + sslkeys[0].ext + " && \
					mv " + sslkeys[1].path + " " + global.app_path + "/ezseed" + sslkeys[1].ext + " && \
					mv *ezseed.key ezseed.pem* /usr/local/nginx/").toString();

			exec(cmd, function(error, stdout, stderr) {
				
				if(error) {
					console.log('error', error);
				}


				self.nginx_copy_config(done);
			});
				 
		} else {
			var cmd = "openssl req -new -x509 -days 365 -nodes -out /usr/local/nginx/ezseed.pem -keyout /usr/local/nginx/ezseed.key -subj '/CN=ezseed/O=EzSeed/C=FR'";
			exec(cmd, function(error, stdout, stderr) {

				self.nginx_copy_config(done);
			});
		}

	}
};

module.exports = configure;
