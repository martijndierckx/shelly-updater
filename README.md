# Shelly Updater Docker image

Run the following docker compose config once in a while to update all your Shelly devices to the latest firmware. 

```
version: '3'
services:
  shelly-updater:
    container_name: shelly-updater
    image: martijndierckx/shelly-updater
    restart: unless-stopped
    #environment:
    #- SHELLY_UPDATE_IP=192.168.4.100 # Overrides the automatically detected IP where the FW files will be hosted for the Shellies to fetch
    #- SHELLY_UPDATE_PORT=3360
    ports:
    - "3360:3360"
```

This docker image is not intended to being kept running 24/7. But more as an ad-hoc update script.