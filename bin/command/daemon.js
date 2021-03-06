var console = require(global.config.root+'/core/logger');
var spawn = require('child_process').spawn, exec = require('child_process').exec;

var shortcut = function(cmd, cb) {
	var running = spawn('/etc/init.d/ezseed.sh', [cmd]);

	running.stdout.on('data', function (data) {
		var string = new Buffer(data).toString();
		console.info(string);
	});

	running.stderr.on('error', function (data) {
		var string = new Buffer(data).toString();
		console.error(string);
		
	});

	running.on('exit', function (code) {

		if(cmd == 'start') {
			//check if ezseed has been started
			var c = 'ps -ef | grep "pm2: ezseed" | grep -v grep';

			exec(c, function(err, stdout, stderr) {
				
				if(stdout.length) {
					if(typeof cb == 'function')
						cb(code);
					else
						process.exit(code);
				} else {
					//if not start it manually

					c = 'pm2 start '+global.app_path+'/ezseed.json';

					exec(c, function(err) {
						if(typeof cb == 'function')
							cb(err);
						else
							process.exit(err);
					});
				}
			});
		} else {

			if(typeof cb == 'function')
				cb(code);
			else
				process.exit(code);
		}
	});
}

module.exports.daemon = shortcut;

module.exports.program = function(program) {
	program
		.command('start')
		.action(function() {
			shortcut('start');
		});

	program
		.command('stop')
		.action(function() {
			shortcut('stop');
		});

	program
		.command('restart')
		.action(function() {
			shortcut('restart');
		});
}