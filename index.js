const express = require("express");
const app = express();
var cors = require('cors');
var http = require('http').createServer(app);
const io = require('socket.io')(http, {
	cors: {
		origin: '*',
	}
});

var {
	getUnix,
	getUrlVars,
	validateAppUrl,
	random,
	pick,
	save,
	number_format
} = require("./addons/utils");

app.use(cors());
app.use(express.json());

const users = require('./database/users.json');

setInterval(() => {
	var online = 0;
	for(i in users) {
		if(users[i].online == true) online += Number(1);
	};
	io.emit('getOnline', online);

	for (i in users) {
		var user = users[i];
		if (user) {
			if (getUnix() > user.bonusTime || !user.bonusTime) {
				user.bonus = true;
				user.bonusTime = getUnix() + 14400000;
				save("users", users);
			};
			if (getUnix() > user.videoTime || !user.videoTime) {
				user.video = true;
				user.videoTime = getUnix() + 60000;
				save("users", users);
			};
		}
	}
}, 7500);

io.on('connection', async function (socket) {
    var params = socket.handshake.query.params;
	var vars = socket.handshake.query;
	if(params) {
		/*
		var prov = validateAppUrl(params, secret_key);
		if (prov.sign != prov.vk) {
			socket.disconnect();
			console.log(`err1`, prov);
			return;
		};
		params = getUrlVars(params);
		if (Number(params.vk_user_id) != Number(vars.uid)) {
			socket.disconnect();
			console.log(`err`);
			return;
		};
		*/
		let user = users[socket.handshake.query.uid];
		if(!user) {
			users[socket.handshake.query.uid] = {
				uid: socket.handshake.query.uid,
				photo: socket.handshake.query.photo,
				nick: socket.handshake.query.nick,
				online: true,
				bonus: true,
				video: true,
				ingame: false,
				ingamesocket: "",
				balance: 0,
				top: 0,
				bonusTime: getUnix(),
				videoTime: getUnix()
			};
			save("users", users);
			user = users[socket.handshake.query.uid];
		};
		const sendData = setInterval(() => {
			socket.emit('response', {
				"type": "userData",
				"bonus": user.bonus === true ? 1 : 0,
				"balance": user.balance
			});
		}, 7500);
		socket.emit('response', {
			"type": "userData",
			"bonus": user.bonus === true ? 1 : 0,
			"balance": user.balance
		});
		user.online = true;
		save("users", users);
		socket.on(`disconnect`, () => {
			clearInterval(sendData);
			user.online = false;
			user.ingame = false;
			user.ingamesocket = "";
			save("users", users);
		});

		socket.on('request', (msg) => {
			if (msg.type === 'bonus') {
				let randAmount = random(1, 500);
				if (user.bonus) {
					user.balance += Number(randAmount);
					user.bonus = false;
					save("users", users);
				};
				socket.emit(`response`, {
					'type': 'bonusUpdate',
					'balance': user.balance,
					'randAmount': randAmount,
					'bonus': user.bonus === true ? 1 : 0
				});
			};
			if (msg.type === 'watchAds') {
				if (msg.data.result) {
					if(user.video) {
						var randAmount = random(1, 50);
						user.balance += Number(randAmount);
						save("users", users);
						socket.emit(`response`, {
							'type': 'successAds',
							'balance': user.balance,
							'amount': randAmount
						});
						return;
					} else {
						socket.emit(`response`, {
							'type': 'errorAds'
						});
						return;
					};
				}
				else {
					socket.emit(`response`, {
						'type': 'errorAds'
					});
					return;
				}
			};
			if(msg.type == 'getTop') {
				let top = [];
				let resArr = []
				let myResArr = {};
    			let me = 0;
    			for (i in users){
        			top.push({
						id: 0,
            			uid: users[i].uid,
            			nick: users[i].nick,
            			photo: users[i].photo,
						top: users[i].top ? users[i].top : 0,
						me: users[i].uid === Number(socket.handshake.query.uid) ? 1 : 0
        			});
    			};
				top.sort((a, b) => {
					return b.top - a.top;
				});
				top.filter((x, i) => {
					if (i < 50) {
						x.id = i + 1;
						resArr.push(x);
						if (x.uid === Number(socket.handshake.query.uid)) {
							myResArr = x;
							me = 1;
						};
					};
				});
				if (me == 0) {
					top.filter((x, i) => {
						x.id = i + 1;
						if(x.uid == Number(socket.handshake.query.uid)) {
							myResArr = x;
							me = 1;
						};
					});
				};
				socket.emit(`response`, {
					'type': 'topData',
					'array': resArr,
					'my': myResArr
				});
				return;
			};
		});
	};
});

http.listen(3000, () => {
	console.log("Started");
});