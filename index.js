const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const ip = require('ip');
const mdns = require('multicast-dns')();
const express = require('express');

(async () => {
  const firmwares = {};

  // Utils
  const fwv = (s) => {
    return parseInt(s.substring(0, 15).replace('-', ''), 10);
  };
  const getFW = async (type) => {
    if (!firmwares[type].fw) {
      const fw = await fetch(firmwares[type].url);
      firmwares[type].fwFileName = firmwares[type].url.substring(firmwares[type].url.lastIndexOf('/') + 1);
      firmwares[type].fw = Buffer.from(await fw.arrayBuffer());
    }

    return firmwares[type];
  };

  // Ip
  const listeningIp = process.env.SHELLY_UPDATE_IP ?? ip.address();

  // Port
  const listeningPort = process.env.SHELLY_UPDATE_PORT ?? 3366;

  // Shelly auth
  const shellyAuth = process.env.SHELLY_UPDATE_AUTH ? process.env.SHELLY_UPDATE_AUTH + '@' : '';

  // Get Shelly FW list
  const fwResp = await fetch(`https://api.shelly.cloud/files/firmware`);
  const fwJson = await fwResp.json();
  if (!fwJson || (fwJson && !fwJson.isok)) {
    throw new Error('No firmware list received from Shelly Cloud');
  }
  for (const [devicetype, fw] of Object.entries(fwJson.data)) {
    firmwares[devicetype] = {
      url: fw.url,
      v: fwv(fw.version),
      vName: fw.version
    };
  }

  // Initiate mDNS discovery
  const shellies = [];
  console.log(`Waiting for shellies to appear ...`);
  mdns.on('response', async (response) => {
    try {
      // Found Shelly?
      const shelly = response.answers.find((v) => v.name.toLowerCase().includes('shelly') && v.type === 'A');
      if (shelly) {
        const shellyIp = shelly.data;
        // Only handle each shelly once
        if (shellies.indexOf(shellyIp) < 0) {
          shellies.push(shellyIp);

          // Log
          console.log(`Detected shelly on ${shellyIp}`);

          // Get info from Shelly
          const response = await fetch(`http://${shellyAuth}${shellyIp}/shelly`);
          const json = await response.json();

          // Detect generation
          let gen = 1;
          if (json.gen) {
            gen = 2;
          }

          if (gen == 1) {
            // Needs update?
            const deviceVersion = fwv(json.fw);
            const newestVersion = firmwares[json.type].v;
            if (deviceVersion < newestVersion) {
              // Get FW
              const fw = await getFW(json.type);

              // Log
              console.log(`Initiating update on ${shellyIp} from ${json.fw} to ${fw.vName}`);

              // Initiate FW update
              await fetch(`http://${shellyAuth}${shellyIp}/ota?url=http://${listeningIp}:${listeningPort}/fw/${fw.fwFileName}`);
            }
            else {
              console.log(`Shelly ${shellyIp} doesn't need to be updated. Current version: ${json.fw}`);
            }
          } else {
            // Try an online update
            console.log(`Attempting online update on gen${gen} ${shellyIp}`);
            await fetch(`http://${shellyAuth}${shellyIp}/ota?update=true`);
          }
        }
      }
    } catch (e) {
      console.error(`Couldn't process/update shelly:\n${e}`);
    }
  });

  // Setup express
  const app = express();
  app.get('/fw/:file', (req, res) => {
    const file = req.params.file;
    const fws = Object.values(firmwares);
    const fw = fws.find((x) => {
      return x.fwFileName == file;
    });

    if (fw) {
      res.send(fw.fw);
    } else {
      res.sendStatus(404);
    }
  });
  app.listen(listeningPort);
})();
