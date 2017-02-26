const { Accessory } = require('homebridge-plugin-helpers');
const { NetworkObserver } = require('./network');

module.exports = function (homebridge) {
	PeoplePlusAccessory.register(homebridge);
};

class PeoplePlusAccessory extends Accessory {

	static get pluginName() {
		return "homebridge-people-plus";
	}
	
	static get accessoryName() {
		return "PeoplePlus";
	}

	constructor(homebridge, log, config, api) {
		super();
		// Save args
		this.log = log;
		this.config = config;
		this.api = api;
		// Setup Homebridge
		this.Service = homebridge.hap.Service;
		this.Characteristic = homebridge.hap.Characteristic;
		// Setup Service
        this.isDetected = false;
		this.service = new this.Service.MotionSensor(this.name);
		this.setupCharacteristics();
        this.setupDeviceObserver();
	}

	get name() {
		return this.config.name;
	}

	get manufacturer() {
		return "Samsung TV";
	}

	get model() {
		return "1.0.0";
	}

	get serialNumber() {
		return this.config.device.mac;
	}

	setupCharacteristics() {
		const { Characteristic } = this;
		const motion = this.service
			.getCharacteristic(Characteristic.MotionDetected)
			.on('get', (callback) => callback(null, this.isDetected))
			;
		const active = this.service
			.getCharacteristic(Characteristic.StatusActive)
			.on('get', (callback) => callback(null, this.isDetected))
			;
		this.characteristics = {
            motion,
			active,
		};
	}

    setupDeviceObserver() {
        const { net } = this;
        const { mac } = this.config.device;
        net.on(`device:mac:${mac}`, device =>
            this.setDetected(device.active)
        );
        net.on(`connected:mac:${mac}`, (device) =>
            this.isDetected(true)
        );
        net.on(`disconnected:mac:${mac}`, (device) =>
            this.isDetected(false)
        );
    }

    static get net() {
        if (!this._net) {
            this._net = new NetworkObserver();
        }
        return this._net;
    }

    get net() {
        return this.constructor.net;
    }

    setDetected(isDetected) {
        const { motion, active } = this.characteristics;
        this.isDetected = isDetected;
        motion.updateValue(isDetected);
        active.updateValue(isDetected);
    }

}
