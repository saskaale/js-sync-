import {REQUEST_NTP} from './constants';
import Connected from './utils/connected';

export default Connected(class NTP{
  constructor(communicator){
    this._ready = [];
    this.loaded = false;

    

    this._waitUntil(() =>{
      this.refresh = () => {
        /*
         Implementation of the NTP protocol
         */
        console.log('NTP request');
        communicator.request(REQUEST_NTP,
          {
            ct:new Date().getTime()
          }).then((data) => {
            console.log('NTP received');
            const nowTimeStamp = new Date().getTime();
            const serverClientRequestDiffTime = data.diff;
            const serverTimestamp = data.serverTimestamp;
            const serverClientResponseDiffTime = nowTimeStamp - serverTimestamp;
            const responseTime = (
                serverClientRequestDiffTime
                - nowTimeStamp
                + serverTimestamp
                - serverClientResponseDiffTime
              )/2;

            const syncedServerTime = nowTimeStamp + serverClientResponseDiffTime - responseTime;
            this.servClientdiff = syncedServerTime - new Date().getTime();

            console.log("NTP loaded");
            this._loaded();
        });/*.catch(() => {
//          console.log("CATCH");
          this.refresh();
        });*/
      };
      communicator.on('open', () => this.refresh());
    });
  }
  getTime(){
    return new Date().getTime() + this.servClientdiff;
  }
});
