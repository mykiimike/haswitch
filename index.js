const execSuper = require('child_process').execSync;
const fs = require('fs');

var file = process.argv[2];
var mode = process.argv[3];
var specific = process.argv[4] ? process.argv[4] : null;

try {
	var data = JSON.parse(fs.readFileSync(file));
} catch(e) {
	console.log(e.message);
	process.exit(0);
}
var segment = data.segment;
var interface = data.interface;
var iptablesPrefix = segment.toUpperCase();

function exec(cmd) {
	console.log(cmd);
	try {
		execSuper(cmd);
	} catch(e) {}
}

try {
	switch(mode) {
		case 'start':
			/* change network state */
			if(!specific) {
				exec('ifup '+interface);
				exec('iptables -t nat -F PRE'+iptablesPrefix);
				exec('iptables -t nat -F POST'+iptablesPrefix);
				exec('iptables -t nat -N PRE'+iptablesPrefix);
				exec('iptables -t nat -N POST'+iptablesPrefix);
			}

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
			
			if(!specific) {
				//exec('iptables -t nat -A POSTROUTING -o eth0 -j POST'+iptablesPrefix);
				//exec('iptables -t nat -A PREROUTING -i eth0 -j PRE'+iptablesPrefix);
			}

			/* prepare drbd */
			if(!specific) {
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

			break;
	
		case 'stop':
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
			if(!specific) {
				exec('vgchange -an '+segment);
				exec('lvchange -an '+segment);
				exec('drbdadm secondary '+segment);
				
				exec('vgscan --cache');
				exec('lvscan --cache');

				/* change network state */
				//exec('iptables -t nat -D POSTROUTING -o eth0 -j POST'+iptablesPrefix);
				//exec('iptables -t nat -D PREROUTING -i eth0 -j PRE'+iptablesPrefix);
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
				//exec('iptables -t nat -X PRE'+iptablesPrefix);
				//exec('iptables -t nat -X POST'+iptablesPrefix);
				exec('ifdown '+interface);
			}

			break;
	}
} catch(e) {
	console.log(e.message);
}

