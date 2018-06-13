import {Message, Transport, TransportContext} from "roal";
// import * as noble from "noble";
import * as Noble from "noble/lib/noble";
import * as buildBindings from "noble/lib/resolve-bindings";
import {defer, Deferred} from "./defer";

export interface NobleTransportOptions {
  serviceUUID: string;
  characteristicUUID: string;
}

export class NobleTransport extends Transport{
  protected _noble;
  protected _serviceUUID: string;
  protected _characteristicUUID: string;
  protected _peripheral?;
  protected _characteristic?;

  protected _deferred: Deferred<any>;

  constructor(options: NobleTransportOptions) {
    super();

    this._serviceUUID = options.serviceUUID;
    this._characteristicUUID = options.characteristicUUID;
    this._noble = new Noble(buildBindings());

    this._deferred = defer();

    this.init();
  }

  get active(): boolean {
    return Boolean(this._peripheral || this._characteristic);
  }

  get ready() {
    return this._deferred.promise;
  }

  init() {
    const noble = this._noble;

    noble.on('stateChange', state => {
      if (state === 'poweredOn') {
        this._startScanning()
      } else {
        this._stopScanning()
      }
    });

    noble.on('discover', peripheral => {
      // connect to the first peripheral that is scanned
      noble.stopScanning();
      const name = peripheral.advertisement.localName;
      console.log(`Connecting to '${name}' ${peripheral.id}`);
      this._connectAndSetup(peripheral);
    });
  }

  _connectAndSetup(peripheral) {

    peripheral.connect(error => {
      if (error) {
        return console.error(error);
      }
      this._peripheral = peripheral;

      console.log('Connected to', peripheral.id);

      peripheral.discoverSomeServicesAndCharacteristics(
        [this._serviceUUID],
        [this._characteristicUUID],
        (error, services, characteristics) => {
          if (error) {
            return console.error(error);
          }
          this._discovered(characteristics[0]);
        }
      );
    });

    peripheral.on('disconnect', () => {
      this._deferred = defer();
      this._peripheral = undefined;
      this._characteristic = undefined;
      console.log('disconnected');
    });
  }

  _discovered(characteristic) {
    this._characteristic = characteristic;

    let buf = Buffer.allocUnsafe(0);
    let seq = 0;

    // data callback receives notifications
    characteristic.on('data', (data: Buffer, isNotification) => {
      let n = data.readUInt16LE(0);
      if (seq !== (n & 0x7FFF)) {
        throw new Error('sequence not match');
      }
      buf = Buffer.concat([buf, data.slice(2)], buf.length + data.length - 2);
      if (n & 0x8000) {
        // end
        this.read(buf);
        buf = Buffer.allocUnsafe(0);
        seq = 0;
      } else {
        seq += data.length - 2;
      }
    });

    // subscribe to be notified whenever the peripheral update the characteristic
    characteristic.subscribe(error => {
      if (error) {
        return console.error('Error subscribing');
      }
      console.log('Subscribed for notifications');
      this._deferred.resolve(characteristic);
    });
  }

  async _startScanning() {
    return promiseFromCallback(cb => this._noble.startScanning([this._serviceUUID], false, cb));
  }

  async _stopScanning() {
    return promiseFromCallback(cb => this._noble.stopScanning(cb));
  }

  async start() {
    if (!this.active) {
      return this._startScanning();
    }
    throw new Error('Already active');
  }

  async close() {
    if (this._peripheral) {
      return promiseFromCallback(cb => this._peripheral.disconnect(cb));
    }
    throw new Error('Already inactive');
  }

  read(data: Buffer) {
    const s = data.toString('utf-8');
    console.log('received: ' + s);
    this.recv(JSON.parse(s));
  }

  async send(message: Message, context?: TransportContext) {
    await this.ready;
    this._characteristic.write(Buffer.from(JSON.stringify(message)), 'utf-8');
  }
}

export default NobleTransport;

function promiseFromCallback(fn: Function) {
  return new Promise((resolve, reject) => {
    fn((err, result) => {
      if (err) return reject(err);
      resolve(result);
    })
  });

}
