import {serialize, deserialize} from './utils/serializer';
import uuidv1 from 'uuid/v1';

const requestFunName = (n) => "request_"+n;
class WSConnection{
  constructor(uid, ws){
    this._uid = uid;
    this._ws = ws;

    this._requests = new Map();

    console.log("NEW CLIENT connection");
  }
  static registerRequest(type, handler){
    type = requestFunName(type);
    if(this.prototype[type])
      throw new Error('Request ( function '+type+' ) already exists');
    this.prototype[type] = handler;
  }
  _onMessage(msg){
    this.onMessage(deserialize(msg));
  }
  _send(d){
    console.log('send '+JSON.stringify(d));
    this._ws.send(serialize(d));
  }
  onClose(){}
  sendRaw(d){
    this._send(d);
  }
  send(type, data){
    return this.sendRaw({t: type, d:data});
  }
  request(t, request = {}, ds = undefined){
    request.t = t;
    if(ds !== undefined){
      request = {s: ds+"" , d:request};
    }
    let uniqk = request.k = request.k || uuidv1();

    return new Promise((resolve, reject) => {
      this._requests.set(uniqk, {resolve, reject});
      try{
        this.sendRaw(request);
      }catch(e){
        this._requests.delete(uniqk);
        reject();
      }
    });
  }
  onMessage(msg){
    console.log('receive '+JSON.stringify(msg));

    let response = {};
    if(msg.k)
      response.k = msg.k;

    let t = requestFunName(msg.t);
    if(this[t]){
      try{
        const reqRet = this[t].call(this, msg);
        if(reqRet)
          response.d = reqRet;
        else if(reqRet === false)
          response = undefined;
      }catch(e){
        response.err = `Unexpected error >>${e.message}<< during processing request occured`;
        response.stack = e.stack;
      }
    }else if(msg.k){
      const promise = this._requests.get(msg.k);
      if(promise){
        promise.resolve(msg.d);
        this._requests.delete(msg.k);
        return;
      }
      this._requests.delete(msg.k);
      response.err = "Unknown key >>"+msg.k+"<<";
    }else{
      response.err = "Unknown request >>"+msg.k+"<<";
    }

    if(response && !msg.err){
      this._send(response);
    }
  }
}

export default WSConnection;
