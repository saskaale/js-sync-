import Communicator from './communicator';
import NTPprotocol from './ntp';
import Connected from './utils/connected';
import DataClient from './dataclient';
import DataStruct, {TinySeq} from '../../transaction-object';


const defaultConf = {
  Communicator,
  CommunicatorOptions: {
    VERBOSE: 1
  }
};

export default Connected(class Client{
  constructor(/*datastruct, */options = {}){
    this.options = options = {...defaultConf, ...options};

    this._listeners = {};

    this._waitUntil(() => {
      this.communicator = 
            new options.Communicator(
              options.CommunicatorOptions,
              this.listenData.bind(this));

      this.ntpservice = new NTPprotocol(this.communicator);

      this.communicator.connected(()=>{
        console.log("CONNECT TO NTP");
        let listener = this.registerListener('null', new DataStruct(), {internal: true});
        listener.connected(() => {
          this.ntpservice.connected(this._loaded.bind(this));
        });
      });
      this.request = this.communicator.request.bind(this.communicator);
    });

  }
  registerListener(name, ds, params = {}){
    const listener = new DataClient(TinySeq(params).concat({client: this, datastruct: ds, name}).toObject());
    this._listeners[name] = {
      ds,
      listener
    };
    return listener;
  }
  unregisterListener(name){
    this._listeners[name] && this._listeners[name].destruct();
    delete this._listeners[name];
  }
  doRequest(data){
    throw new Error("Unknown request type");
  }
  listenData(data){
    let ret = {};
    if(data.k)
      ret.k = data.k;

    const error = (msg) => {
      ret = {"err": msg};
    }

    try{
      if(data.s){
        if(this._listeners[data.s])
          ret.d = this._listeners[data.s].listener.doRequest(data.d);
      }else
        ret.d = this.doRequest(data);
    }catch(e){
      error(e.message);
    }

    if(ret)
      this.communicator.send(ret);
  }
});
