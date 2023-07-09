# Shelly Offline Updater Docker image

When you are running your shellies in a separate VLAN without any internet access, but still want them to be updated once in a while, you can use this Docker image to achieve that.

Run it on a Docker host with internet access which is also reachable by the Shellies.

``` yaml
version: '3'
services:
  shelly-updater:
    container_name: shelly-updater
    image: martijndierckx/shelly-updater
    restart: unless-stopped
    #environment:
    #- SHELLY_UPDATE_IP=192.168.4.100 # Overrides the automatically detected IP where the FW files will be hosted for the Shellies to fetch
    #- SHELLY_UPDATE_PORT=3366
    #- SHELLY_UPDATE_AUTH="admin:yourpassword" # Set when your shellies are protected by a password
    ports:
    - "3366:3366"
```

This Docker image is not intended to run 24/7. But more as an ad-hoc update script. So make sure you stop the container/stack after updating.

### Credits
Based of [Benedict's work](https://github.com/bjuretko/shelly-offline-ota-update)