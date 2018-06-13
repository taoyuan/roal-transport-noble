import {RPC} from "roal";
import NobleTransport from "../src";

const rpc = RPC.create(new NobleTransport({
  serviceUUID: 'ec00',
  characteristicUUID: 'ec0e'
}));

(async () => {
  const result = await rpc.request('echo', ['Hello World at ' + new Date()]);
  console.log(result);
})();
