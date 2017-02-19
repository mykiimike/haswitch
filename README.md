**haswitch** is a Linux high availability tool to manage VM synchronization in a RAID 10 environment (machine-to-machine).
Its primary goal is to switch LXC virtual machines onto LVM + DRBD.
Its secondary goal is to manage the network coming with virtual machines then it manages iptables and bridges.
**haswitch** also supports OVH's failover API which allow to switch failover ip during the migration.

# Install
```bash
sudo npm install -g haswitch
```

# Operations

Show configuration
```bash
haswitch show
```

Start all resources
```bash
haswitch start
```

Stop ha0 resource
```bash
haswitch start ha0
```

Start VM vm1ha0 on ha0 resource
```bash
haswitch start ha0 vm1ha0
```

Stop VM vm1ha0 on ha0 without execution
```bash
haswitch -e stop ha0 vm1ha0
```

# LXC
## Install LXC
```bash
sudo apt-get install lxc lxc-templates wget bridge-utils
```

## Prepare LXC
Disable the default bridge “lxcbr0“,  got created as part of LXC installation.

```bash
sudo nano /etc/default/lxc-net
```

Set “USE_LXC_BRIDGE” to “false“.

```bash
USE_LXC_BRIDGE="false"
```
# DRBD
I suggest you to follow the guide from Zarafa:
* https://doc.zarafa.com/trunk/Zarafa_HA_Manual/en-US/html/_drbd_device_initialization.html

The DRBD resource name must have the same name as a haswitch resource.

# ISP Integration

## OVH
Edit your /etc/haswitch.json and add:
```json
ovh: {
  "me": "nsXXX.ovh.net",
  "endpoint": "ovh-eu",
  "appKey": "APP_KEY",
  "appSecret": "APP_SECRET",
}
```

Customer Key will come after running the credential checker.
```bash
haswitch ovh auth
```
A validation URL will be given You will have to follow it in order to activate the application. Once you have done that you will have the customer key:

```json
ovh: {
  "me": "nsXXX.ovh.net",
  "endpoint": "ovh-eu",
  "appKey": "APP_KEY",
  "appSecret": "APP_SECRET",
  "consumerKey": "Given consumerKey",
}
```

Now you have to activate OVH failover on the LXC container
```json
{
  "ovh": true,
  "vm": "vm1ha0",
  "public": {
    "internal": "192.168.0.6",
    "external": "1.2.3.2",
    "internal6": "fd67:d076:089a:8da3::",
    "external6": "2003:dead:beef:f80c::",
  }
}
```

Once you have configured you can check the OVH's failover status:
```bash
haswitch ovh check
```

To redirect all failover IP in every resources on Me (see ovh.me):
```bash
haswitch ovh failover
```

Or for a specific resource:
```bash
haswitch ovh failover ha0
```
