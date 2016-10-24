#!/usr/bin/node

const EventEmitter = require('events');
const fs = require('fs');
const program = require('commander');
const execSuper = require('child_process').execSync;
const prettyjson = require('prettyjson');

console.pretty = function(data) {
	console.log(prettyjson.render(data));
}

function list(val) {
	return val.split(',');
}

var commandEmulation = false;

var haswitch = function(args, resource) {
	var self = this;
	this.opts = args;
	this.config = {};

	commandEmulation = args.emulate == true ? true:false;

	/* read config file */
	try {
		var st = fs.statSync(args.config);
		this.config = JSON.parse(fs.readFileSync(args.config));
	} catch(e) {
		console.log('Can not found JSON configuration file at '+args.config);
		process.exit(-1);
	}
	var json = this.config;

	/* load resource */
	if(resource) {
		if(!json.resources[resource]) {
			console.log('Can not find resource '+resource+' in '+args.config);
			process.exit(-1);
		}
		this.current = json.resources[resource];
	}
};

function exec(cmd) {
	if(commandEmulation == false) {
		console.log('[EXEC] '+cmd);
		try {
			execSuper(cmd);
		} catch(e) {}
	}
	else {
		console.log(cmd);
	}
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Start process
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
function start(resource, specific) {
	var hs = new haswitch(program, resource);

	if(!resource) {
		for(var a in hs.config.resources)
			start(a, null)
		process.exit(0);
	}

	/* prepare argument */
	var data = hs.current;
	var segment = hs.current.segment;
	var interface = hs.current.interface;
	var iptablesPrefix = segment.toUpperCase();

	/* change network state */
	if(!specific) {
		exec('ifup '+interface);
		exec('iptables -t nat -F PRE'+iptablesPrefix);
		exec('iptables -t nat -F POST'+iptablesPrefix);
		exec('iptables -t nat -N PRE'+iptablesPrefix);
		exec('iptables -t nat -N POST'+iptablesPrefix);
	}

	/* Add iptable forwarding */
	for(var a in data.machines) {
		var machine = data.machines[a];
		if(specific && specific != machine.vm)
			continue;

		if(machine.public) {
			var i = machine.public.internal;
			var e = machine.public.external;

			exec('iptables -t nat -A POST'+iptablesPrefix+' -s '+i+' -j SNAT --to-source '+e);
			exec('iptables -t nat -A PRE'+iptablesPrefix+' -d '+e+' -j DNAT --to-destination '+i);
		}
	}

	/* prepare drbd */
	if(!specific && data.drbd == true) {
		exec('drbdadm up '+segment);
		exec('drbdadm primary '+segment);
		exec('vgscan --cache');
		exec('lvscan --cache');
		exec('vgchange -ay '+segment);
		exec('lvchange -ay '+segment);
	}

	/* unmount everything */
	for(var a in data.machines) {
		var machine = data.machines[a];

		if(specific && specific != machine.vm)
			continue;

		exec('mount /dev/'+segment+'/'+machine.vm+' /data/'+segment+'/'+machine.vm);
	}

	/* start all vm */
	for(var a in data.machines) {
		var machine = data.machines[a];

		if(specific && specific != machine.vm)
			continue;

		exec('lxc-start -n '+machine.vm);
	}

}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Stop process
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
function stop(resource, specific) {
	var hs = new haswitch(program, resource);

	if(!resource) {
		for(var a in hs.config.resources)
			stop(a, null)
		process.exit(0);
	}

	/* prepare argument */
	var data = hs.current;
	var segment = hs.current.segment;
	var interface = hs.current.interface;
	var iptablesPrefix = segment.toUpperCase();

	/* stop all VM */
	for(var a in data.machines) {
		var machine = data.machines[a];

		if(specific && specific != machine.vm)
			continue;

		exec('lxc-stop -k -n '+machine.vm);
	}

	/* unmount everything */
	for(var a in data.machines) {
		var machine = data.machines[a];

		if(specific && specific != machine.vm)
			continue;

		exec('umount /data/'+segment+'/'+machine.vm);
	}

	/* change drbd state */
	if(!specific && data.drbd == true) {
		exec('vgchange -an '+segment);
		exec('lvchange -an '+segment);
		exec('drbdadm secondary '+segment);

		exec('vgscan --cache');
		exec('lvscan --cache');
	}

	for(var a in data.machines) {
		var machine = data.machines[a];

		if(specific && specific != machine.vm)
			continue;

		if(machine.public) {
			var i = machine.public.internal;
			var e = machine.public.external;

			exec('iptables -t nat -D POST'+iptablesPrefix+' -s '+i+' -j SNAT --to-source '+e);
			exec('iptables -t nat -D PRE'+iptablesPrefix+' -d '+e+' -j DNAT --to-destination '+i);
		}
	}

	if(!specific) {
		exec('iptables -t nat -F PRE'+iptablesPrefix);
		exec('iptables -t nat -F POST'+iptablesPrefix);
		exec('ifdown '+interface);
	}

}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Restart process
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
function restart(resource, specific) {
	stop(resource, specific);
	start(resource, specific);
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Show configuration process
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
function show() {
	var hs = new haswitch(program);
	console.pretty(hs.config);
	process.exit(0);
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Network process
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
function network(cmd, resource, subcall) {
	var hs = new haswitch(program, resource);

	if(!resource) {
		for(var a in hs.config.resources)
			network(cmd, a, true)
		process.exit(0);
	}

	/* prepare argument */
	var data = hs.current;
	var segment = hs.current.segment;
	var interface = hs.current.interface;
	var iptablesPrefix = segment.toUpperCase();

	if(cmd == 'init') {
		exec('iptables -t nat -N PRE'+iptablesPrefix);
		exec('iptables -t nat -N POST'+iptablesPrefix);

		if(subcall != true)
			process.exit(0)
		return;
	}
	else if(cmd == 'fini') {
		exec('iptables -t nat -X PRE'+iptablesPrefix);
		exec('iptables -t nat -X POST'+iptablesPrefix);

		if(subcall != true)
			process.exit(0)
		return;
	}

	console.log('Command not found');
	process.exit(-1)
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * Sync lxc symlinks
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
function prepare() {
	var hs = new haswitch(program);

	/* data dirs */
	for(var rname in hs.config.resources) {
		var r = hs.config.resources[rname];
		for(var mp in r.machines) {
				var machine = r.machines[mp];
				var target = '/data/'+rname+'/'+machine.vm;
				exec('mkdir -p '+target);
		}
	}

	/* lxc symlinks */
	for(var rname in hs.config.resources) {
		var r = hs.config.resources[rname];
		for(var mp in r.machines) {
				var machine = r.machines[mp];
				var target = '/data/'+rname+'/'+machine.vm;
				var link = '/var/lib/lxc/'+machine.vm;
				try {
					fs.stat(link);
				} catch(e) {
					exec('ln -s '+target+' '+link);
				}
		}
	}

	process.exit(0);
}

program
	.arguments('<resource>')
	.option('-c, --config [file]', 'Configuration file', '/etc/haswitch.json')
	.option('-e, --emulate', 'Just print commands w/o execution', false)
	.option('-v, --verbose');

program
  .command('start [resource] [machine]')
  .action(start);

program
  .command('stop [resource] [machine]')
  .action(stop);

program
  .command('restart [resource] [machine]')
  .action(restart);

program
  .command('network <init/fini> [resource]')
	.description('Initialize or terminate network chains')
  .action(network);

program
  .command('show')
	.description('Show configuration file')
  .action(show);

program
  .command('prepare')
	.description('Make data dirs and sync LXC /var/lib/lxc symlinks')
  .action(prepare);

program.on('--help', function(){
  console.log('  Examples:');
  console.log('');
  console.log('    $ haswitch start ha0        Start all machines from ha0');
	console.log('    $ haswitch start ha0 vm1ha0 Start machines vm1ha0 from ha0');
	console.log('    $ haswitch network init     Initialize routing chains');
  console.log('');
	console.log('  haswitch.js (c) 2016 - Michael Vergoz');
	console.log('');
});

program.parse(process.argv);
