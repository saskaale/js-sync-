import WSConnection from './wsconnection';
import {
    REQUEST_LOADALL, 
    REQUEST_LIST, 
    REQUEST_SERVERCHANGE, 
    REQUEST_CLIENTCHANGE, 
    REQUEST_CLIENTSYNC, 
    MAX_UNSYNC_COMMITS} from './constants';
import DataStruct, {merger, MERGER_STRATEGIES} from '../../transaction-object';

let datastruct = new DataStruct({
    Task: {},
    SubTask: {},
    SubSubTask: {}
});

class ClientConnection extends WSConnection{
    constructor(...args){
        super(...args);

        this.status = [];

        this._configds = new DataStruct({
          listensTo: {}
        });
        this.config = this._configds.data;

        this.availableDataStructs = {
          [null]: {
                    getData  : () => this._configds,
                    readonly: true
          },
          'data': {
                    getData  :   () => datastruct
          }
        };
        this.listeningDs = {};
    }
    onClose(...args){
        super.onClose && super.onClose(...args);

        for(let k in this.listeningDs)
          this.unsubscribeFrom(k);
        super.onClose();
    }
    subscribeTo(k, silent = false){
        if(!this.availableDataStructs[k])
          throw new Error(`unknown datastruct >>${k}<<`);
        console.log(`subscribe to the ds ${k}`);
        if(this.listeningDs[k])
          throw new Error(`You are already subscribed to the ds ${k}`);
        if(!silent)
          this.config.listensTo[k] = true;

/*        this.request(REQUEST_SERVERCHANGE, {}, k).then(e=>{
            console.log("REQUEST_SERVERCHANGE success");
            console.log(e);
        });
*/

        let subscribe, unsubscribe;
        subscribe = (change) => {
            console.log("---- SEND REQUEST_SERVERCHANGE");
            this.request(REQUEST_SERVERCHANGE, {d:change}, k).then(e=>{
                console.log("REQUEST_SERVERCHANGE success");
                console.log(e);
            });
        };
        unsubscribe = this.availableDataStructs[k].getData().subscribe(subscribe);

        this.listeningDs[k] = {subscribe, unsubscribe};
    }
    _checkDS({s}){
      if(!this.listeningDs[s])
        throw new Error(`Datastruct >>${s}<< is not connected`)
    }
    unsubscribeFrom(k){
        console.log(`unsubscribe from the ds ${k}`);
        if(this.listeningDs[k]){
            console.log(this._configds.immutable.toJS());

            this.listeningDs[k].unsubscribe(k);
            console.log("UNSUBSCRIBE FROM "+k);
            console.log(k);
            delete this.config.listensTo[k];
            delete this.listeningDs[k];
        }
    }
}

ClientConnection.registerRequest(REQUEST_CLIENTSYNC, function(d){
    console.log("CLIENTSYNC");
    console.log(d);

    this.subscribeTo(d.s);

    let conf = this.availableDataStructs[d.s];
    let datastruct = conf.getData();

    console.log("DATASTRUCT");
    console.log(datastruct);


    const {curVersion} = d.d

    console.log("REQUEST_CLIENTCHANGE");
    console.log(d);

    const foundCommit = datastruct.find(curVersion,MAX_UNSYNC_COMMITS);
    if(foundCommit){
        console.log("CLIENTSYNC commits");
        console.log(datastruct.commits(curVersion));
        return {
            type: "commits", 
            data: datastruct.commits(curVersion)
        };
    }else{
        console.log("CLIENTSYNC commits");
        console.log(datastruct.toJS(-MAX_UNSYNC_COMMITS));
        return {
            type: "reset", 
            data: datastruct.toJS(-MAX_UNSYNC_COMMITS)
        };
    }
});

ClientConnection.registerRequest(REQUEST_LIST, function(d){
    return Object.keys(this.availableDataStructs);
});

ClientConnection.registerRequest(REQUEST_LOADALL, function(d){
    this.subscribeTo(d.s);

    return this.availableDataStructs[d.s].getData().toJS();
});

ClientConnection.registerRequest(REQUEST_CLIENTCHANGE, function(d){
    this._checkDS(d);
    let conf = this.availableDataStructs[d.s];
    let datastruct = conf.getData();
    const subscribe = this.listeningDs[d.s].subscribe;

    d = d.d;

    switch(d.type){
        case "commit":
            if(conf.readonly)
                throw new Error('datastruct '+d.s+' is readonly');

            return merger(
                datastruct, 
                d.data, 
                {
                    skipSubscribers : new Set([subscribe]),
                    strategy        : MERGER_STRATEGIES.LOCAL
                }
            );
        case "reset":{
            return datastruct.fromJS(d.data);
        }
        default:
            throw new Error("unknown type of request "+REQUEST_CLIENTCHANGE+"::"+d.type);
    }
});

export default ClientConnection;
