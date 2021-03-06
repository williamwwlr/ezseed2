var fs = require('fs')
    , _ = require('underscore')
    , path = require('path');

var db = require('./database');

var md = require("node-markdown").Markdown;
var _s = require('underscore.string');

var console = require(global.config.root + '/core/logger');

var plugin = {
	inited: false,
	init: function(user, cb) {
		var self = this;

		if(!self.inited) {
			if(user) {
			db.getStatus(user.id, function(err, status) {
				self.enabled = status;
				
				self.inited = true;

				cb(err, self);
			});
			} else {
				cb("No user", self);	
			}

		} else
			cb(null, self);
	},
	name : "Chat",
	enabled : true,
	db: require('./database'),
	static : path.join(__dirname, 'public'),
	stylesheets : ['/css/chat.css'],
	javascripts : ['/js/chat.js'],
	preferences : function() {
		var self = this;
		return _.template(new Buffer(fs.readFileSync(__dirname + '/public/views/preferences.ejs')).toString(), {enabled : self.enabled})
	},
	admin : function() {
		var self = this;
		return '<a href="plugins/chat/purge" title="Purger"><i class="entypo-back-in-time"></i></a>';
	},
	users : [],
	usersBySID : [], //Store socket.id by users
	messages : [],
	views : [
		{
			name : "global",
			path : path.join(__dirname, 'public', 'views', 'chat.ejs'),
			datas : {}
		},
	],
	routes : [
		{
			type : 'GET',
			route : '/user/plugins/chat/disable',
			action :  function(req, res) {
				
				db.setStatus(req.user.id, false, function(err) {
					plugin.enabled = false;
					req.session.success = "Chat désactivé";
					res.redirect('back');
				});
			}
		},

		{ 
			type : 'GET',
			route : '/user/plugins/chat/enable', 
			action : function(req, res) {
				db.setStatus(req.user.id, true, function(err) {
					plugin.enabled = true;
					req.session.success = "Chat activé";
					res.redirect('back');
				});
			}
		},

		{
			type: 'GET',
			route: '/plugins/chat/purge',
			action: function(req, res) {
				db.purge(function() {
					req.session.success = "Chat purgé";
					res.redirect('back');
				});
			}
		}
	]
};

var sockets = function(socket, sockets) {
	socket.on('chat:join', function(u) {
		
		u = _s.slugify(u);

		if(plugin.users.indexOf(u) === -1) {
			plugin.users.push(u);
			plugin.usersBySID.push({u : u, sid : socket.id});
		}
		
		sockets.emit('chat:joined', plugin.users);
		
		db.getMessages(function(err, messages) {
			
			socket.emit('chat:init', messages);
		
		});

	});

	socket.on('chat:message', function(u, m) {
		m = md(m, true);

		db.saveMessage({user : u, message : m}, function(err) {
			sockets.emit('chat:message', {user : u, message : m});
		});
	});

	socket.on('disconnect', function() {

		var u = _.findWhere(plugin.usersBySID, {sid : socket.id});

		if(u) {
			u = u.u;

			var i = plugin.users.indexOf(u);

			if (i > -1) {
	    		plugin.users.splice(i, 1);
				sockets.emit('chat:joined', plugin.users);
			}
		}

	});
};


module.exports.plugin = plugin;

module.exports.sockets = sockets;
