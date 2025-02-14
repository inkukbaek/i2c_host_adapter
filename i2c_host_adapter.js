import { MCP2221 } from "./mcp2221a_web.js";
import { AARDVARK } from "./aardvark_web.js";

export class I2C_HOST_ADAPTER {

    constructor(productName) {
        this.productName = productName;
        this.device;
        this.isConnected = false;
        this.debug = 1;
        this.i2c_devices = [
            { productName:"MCP2221A", filter:{vendorId: 0x04D8, productId: 0x00DD}, productType: "HID" },
            { productName:"AARDVARK", filter:{vendorId: 0x0403, productId: 0xE0D0}, productType: "USB" }
        ];
        this.interfaceNumber
        this.endpointIn
        this.endpointOut
    }

    async initConnection() {
        const stack = new Error().stack.split("\n")[1]; // find method from stack
        const methodName = stack.match(/at (\S+)/)[1];  // extract method name
        let [productInfo] = this.i2c_devices.filter( device => device.productName === this.productName);
        try {
            let response;
            if (productInfo.productType === "USB") {
                this.device = await navigator.usb.requestDevice({filters:[productInfo.filter]});
                if ((this.device === undefined) || !(this.device)) throw new Error('No device selected...');
                if (!this.device.opened) await this.device.open();
                if (this.device.opened) {
                    response = {message:`${this.device.productName} is connected`};
                    this.isConnected = true;
                    if (this.debug===1) console.log(methodName, `${this.device.productName} is connected`);
                    const interfaces = this.device.configuration.interfaces;
                    this.interfaceNumber = interfaces[0].interfaceNumber;
                    for (const endpoint of interfaces[0].alternate.endpoints) {
                        if (endpoint.direction == 'in'){
                            this.endpointIn = endpoint.endpointNumber;
                        };
                        if (endpoint.direction == 'out'){
                            this.endpointOut = endpoint.endpointNumber;
                        };
                    }
                }

            }

            if (productInfo.productType === "HID") {
                [this.device] = await navigator.hid.requestDevice({filters: [productInfo.filter]});
                if ((this.device === undefined) || !(this.device)) throw new Error('No device selected...');
                if (!this.device.opened) await this.device.open();
                if (this.device.opened) {
                    response = {message:`${this.device.productName} is connected`};
                    this.isConnected = true;
                    if (this.debug===1) console.log(methodName, `${this.device.productName} is connected`);

                } else {
                    throw new Error('HID Device connection failed');
                }
            }
            return response;
        } catch (error) {
            console.log(error)
        }
    }

    async initDevice(options) {
        const stack = new Error().stack.split("\n")[1]; // find method from stack
        const methodName = stack.match(/at (\S+)/)[1];  // extract method name
        if (this.debug===1) console.log(methodName, `${this.device.productName} initializing`)
        const i2c_speed = !(options===undefined) ? options.i2c_speed :100;
        switch (this.productName) {
            case "MCP2221A":
                this.adapter = new MCP2221();
                this.adapter.device = this.device;
                await this.adapter.init_state(i2c_speed);
                break;
            case "AARDVARK":
                this.adapter = new AARDVARK();
                this.adapter.interfaceNumber = this.interfaceNumber;
                this.adapter.endpointIn = this.endpointIn;
                this.adapter.endpointOut = this.endpointOut;
                this.adapter.device = this.device;
                break;
        }

    }

    async i2cWrite(i2c_slave_addr, i2c_reg_addr, data, read_back=false) {
        const response = await this.adapter.i2cWrite(i2c_slave_addr, i2c_reg_addr, data, read_back);
        return response;
    }

    async i2cRead(i2c_slave_addr, i2c_reg_addr, i2c_length=1) {
        const response = await this.adapter.i2cRead(i2c_slave_addr, i2c_reg_addr, i2c_length);
        await this.adapter.i2cRead(i2c_slave_addr, i2c_reg_addr, i2c_length);
        return response;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

}