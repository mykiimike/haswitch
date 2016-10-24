
# Install
```bash
sudo npm install -g haswitch
```

# LXC
## Install LXC
sudo apt-get install lxc lxc-templates wget bridge-utils

## Prepare LXC
Disable the default bridge “lxcbr0“,  got created as part of LXC installation.

```bash
sudo nano /etc/default/lxc-net
```

Set “USE_LXC_BRIDGE” to “false“.

```bash
USE_LXC_BRIDGE="false"
```

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
    "external": "1.2.3.2"
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
