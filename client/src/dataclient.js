import {REQUEST_LOADALL, REQUEST_CLIENTCHANGE, REQUEST_SERVERCHANGE, REQUEST_CLIENTSYNC} from './constants';
import {merger, MERGER_STRATEGIES} from '../../transaction-object';
import Connected from './utils/connected';
import uuidv1 from 'uuid/v1';

export default Connected(class DataClient{
  constructor(conf = {}){
    let {client, datastruct, name, internal} = conf;
    this.uuid = uuidv1();
    this.struct_uuid = name;

    this.client = client;
    this.datastruct = datastruct;

    this._requests = {
      [REQUEST_SERVERCHANGE] : this.requestServerDatachange.bind(this)
    };

    this.destructors = [];

    this._subscriber = (d) => {
      console.log("SUBSCRIBE");
      const {srcuuid} = d;
      this.request(REQUEST_CLIENTCHANGE, d)
          .then(({applied})=>{
            if(!applied){
                this.datastruct.rollback(srcuuid);
            }
          }).catch(d=>{
//            console.log('REQUEST catch');
          });
    };

    this._waitUntil(() => {
      let action = () => {
        this.destructors.push(
            this.client.communicator.on('reconnect', this.syncCurrent.bind(this))
          );

        this.loadAll().then( () => {
          this.destructors.push(
              this.datastruct.subscribe(this._subscriber)
            );
          this._loaded();
        });
      };
      internal ? action() : this.client.connected(action);
    });
  }
  _getAllSubscribers(){
    return new Set([this._subscriber]);
  }
  async syncCurrent(){
    const curVersion = this.datastruct.curVersion;
    let syncdata = await this.request(REQUEST_CLIENTSYNC, {curVersion});
    console.log("SYNCDATA "+syncdata);
    this.requestServerDatachange(syncdata);
  }
  async loadAll(){
    console.log("SEND_LOADALL "+this.struct_uuid);
    let d = await this.request(REQUEST_LOADALL);
    console.log("RESET FROMJS "+this.struct_uuid);
    console.log(d);
    this.datastruct.fromJS(d, this._getAllSubscribers());
    console.log(this.datastruct.transactionUuid);
    return d;
  }
  async reset(){
    await this.loadAll();
  }
  destruct(){
    this.destructors.forEach(f => {f()});
    this.destructors = [];
  }
  request(type, data = undefined){
    return this.client.request(type, {s: this.struct_uuid, d:data});
  }
  doRequest(data){
    if(this._requests[data.t])
      return this._requests[data.t](data.d);
    return {"status": "success"};
  }
  requestServerDatachange({type, data:d}){
    const doCommit = (d) => merger(
      this.datastruct,
      d,
      {
        skipSubscribers : this._getAllSubscribers(),
        strategy        : MERGER_STRATEGIES.REMOTE
      }
    );

    switch(type){
      case "commit":
        return doCommit(d);
      case "commits":
        return d.map(doCommit);
     case "reset":
//        console.log("RESET "+this.struct_uuid);
//        console.log(d.data);
        return this.datastruct.fromJS(d, this._getAllSubscribers());

      default:
        throw new Error("Unreachable");
    }
  }
});
