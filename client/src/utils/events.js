import EventEmitter from 'wolfy87-eventemitter';

export default class extends EventEmitter{
    on(evt, cbk){
        super.on(evt, cbk);
        return () => {super.off(evt, cbk)}
    }
}