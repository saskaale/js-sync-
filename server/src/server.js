import WSConnection from './wsconnection';
import uuidv1 from 'uuid/v1';
const WebSocketServer = require('ws').Server;

/*** Support for all requests ***/
import ntp from './requests/ntp';

const defaultConf = {
  port: 40510,
  perMessageDeflate: {
    zlibDeflateOptions: { // See zlib defaults.
      chunkSize: 1024,
      memLevel: 7,
      level: 3,
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    ClientConnection: WSConnection,
    // Other options settable:
    clientNoContextTakeover: true, // Defaults to negotiated value.
    serverNoContextTakeover: true, // Defaults to negotiated value.
    clientMaxWindowBits: 10,       // Defaults to negotiated value.
    serverMaxWindowBits: 10,       // Defaults to negotiated value.
    // Below options specified as default values.
    concurrencyLimit: 10,          // Limits zlib concurrency for perf.
    threshold: 1024,               // Size (in bytes) below which messages
                                   // should not be compressed.
  }
};

export default class Server{
  constructor(conf){
    conf = {...defaultConf, ...conf};

    this._clients = {};

    this._socketserver = new WebSocketServer({port: 8081});//conf);
    this._socketserver.on('connection', (ws) => {
      let clientId = uuidv1();
      let connection = new conf.ClientConnection(clientId, ws);
      ws.on('open', this._onOpen.bind(this,clientId, connection));
      ws.on('close', this._onClose.bind(this,clientId, connection));
      ws.on('message', connection._onMessage.bind(connection));
    });
  }
  _onOpen(id, connection){
    this._clients[id] = connection;
  }
  _onClose(id, connection){
    connection.onClose();
    delete this._clients[id];
  }
}
