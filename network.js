const arp = require('arp-a');
const { EventEmitter } = require('events');
const ping = require ("net-ping");

class NetworkObserver extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.session = ping.createSession();
        this.cachedDevices = [];
        this.tick();
    }
    
    get pollInterval() {
        return 1000;
    }

    get table() {
        return new Promise((resolve, reject) => {
            let hasError = false;
            const entries = [];
            arp.arpTable((error, entry) => {
                if (error) {
                    (!hasError) && reject(error);
                    hasError = true;
                } else {
                    if (entry) {
                        entries.push(entry);
                    } else {
                        return resolve(entries);
                    }
                }
            });
        });
    }

    get devices() {
        return this.table
            .then(entries =>
                Promise.all(entries.map(entry =>
                    this.ping(entry.ip)
                        .then(isActive =>
                            Object.assign({}, entry, {
                                active: isActive
                            })
                        )
                ))
            );
    }

    get activeDevices() {
        return this.devices
            .then(devices => devices.filter(device => device.active))
            ;
    }

    ping(ip) {
        return new Promise(resolve =>
            this.session.pingHost(ip, error =>
                resolve(!error)
            )
        );
    }

	tick() {
		return this.update()//.timeout(this.pollInterval * 2)
			.then(() => setTimeout(() => this.tick(), this.pollInterval))
			.catch(() => setTimeout(() => this.tick(), this.pollInterval))
			;
	}

    update() {
        const { cachedDevices } = this;
        return this.activeDevices
            .then(devices => {
                const cacheMap = cachedDevices.reduce((hash, device) => {
                    hash[device.mac] = device;
                    return hash;
                }, {});
                const previousDeviceKeys = Object.keys(cacheMap);
                const newDevices = [];
                // Check if new device
                devices.forEach(device => {
                    const { mac } = device;
                    const index = previousDeviceKeys.indexOf(mac);
                    const isNewDevice = index === -1;
                    if (isNewDevice) {
                        newDevices.push(device);
                    } else {
                        previousDeviceKeys.splice(index, 1);
                    }
                    this.emit(`device:mac:${device.mac}`, device);
                    this.emit(`device:ip:${device.ip}`, device);
                });
                // Check if device disconnected
                const removedDevices = previousDeviceKeys.map(key => cacheMap[key]);
                // Emit events
                newDevices.forEach(device => {
                    this.emit(`connected:mac:${device.mac}`, device);
                    this.emit(`connected:ip:${device.ip}`, device);
                });
                removedDevices.forEach(device => {
                    this.emit(`disconnected:mac:${device.mac}`, device);
                    this.emit(`disconnected:ip:${device.ip}`, device);
                });
                // Save cache
                this.cachedDevices = devices;
            });
    }

}

// const net = new NetworkObserver();
// net.table.then(entries => console.log(entries));
// net.on("connected:ip:192.168.1.17", (device) => console.log(device));
// net.on("connected:mac:cc:29:f5:3b:a2:f2", (device) => console.log("connected", device));
// net.on("disconnected:mac:cc:29:f5:3b:a2:f2", (device) => console.log("disconnected", device));

module.exports = {
    NetworkObserver
};