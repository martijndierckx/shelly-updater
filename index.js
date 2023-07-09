const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const ip = require('ip');
const mdns = require('multicast-dns')();
const express = require('express');

const firmwares = [];

// Utils
const fwv = (s) => {
  return parseInt(s.substring(0, 15).replace('-', ''), 10);
};
const getFW = async (type) => {
  if (!firmwares[type].fw) {
    const fw = await fetch(firmwares[type].url);
    firmwares[type].fw = await fw.arrayBuffer();
  }

  return firmwares[type];
};

(async () => {
  // Ip
  const listeningIp = process.env.SHELLY_UPDATE_IP ?? ip.address();

  // Port
  const listeningPort = process.env.SHELLY_UPDATE_PORT ?? 3366;

  // Setup express
  const app = express();
  app.get('/fw/:device', (req, res) => {
    const device = req.params.device;
    const fw = Buffer.from(firmwares[device].fw);
    res.send(fw);
  });
  app.listen(listeningPort);

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

  // Shelly auth
  const shellyAuth = process.env.SHELLY_UPDATE_AUTH ? process.env.SHELLY_UPDATE_AUTH + '@' : '';

  // Initiate mDNS discovery
  const shellies = [];
  console.log(`Waiting for shellies to appear ...`);
  mdns.on('response', async (response) => {
    try {
      // Found Shelly?
      const shelly = response.answers.find((v) => v.name.includes('shelly') && v.type === 'A');
      if (shelly) {
        const shellyIp = shelly.data;
        // Only handle each shelly once
        if (shellies.indexOf(shellyIp) < 0) {
          shellies.push(shellyIp);

          // Get info from Shelly
          const response = await fetch(`http://${shellyAuth}${shellyIp}/shelly`);
          const json = await response.json();

          // Needs update?
          const deviceVersion = fwv(json.fw);
          const newestVersion = firmwares[json.type].v;
          if (deviceVersion < newestVersion) {
            // Get FW
            const fw = await getFW(json.type);

            // Log
            console.log(`Initiating update on ${shellyIp} from ${json.fw} to ${fw.vName}`);

            // Initiate FW update
            await fetch(`http://${shellyAuth}${shellyIp}/ota?url=http://${listeningIp}:${listeningPort}/fw/${json.type}`);
          }
        }
      }
    } catch (e) {
      console.error(`Couldn't process/update shelly:\n${e}`);
    }
  });
})();
