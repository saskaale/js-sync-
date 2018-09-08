export default (Parent) => {
  return class extends Parent{
    _waitUntil(f){
      if(!this.loaded) this.loaded = {};
      this._initStatus = this._initStatus || 0;

      this._ready = this._ready || [];

      this.INIT_STEPS = this.INIT_STEPS || 0;
      this.INIT_STEPS++;
      f();
    }
    connected(f, k = ""){
      if(this._initStatus < this.INIT_STEPS){
        this._ready.push(f);
      }else{
        f();
      }
    }
    _loaded(k = ""){
      if(!this.loaded[k]){
        this._initStatus++;
      }
      this.loaded[k] = true;

      if(this._initStatus >= this.INIT_STEPS){
        this._ready.forEach(f=>f());
        this._ready = [];
      }
    }
  }
}
