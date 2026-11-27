export class SaveState{
 constructor({dirty=false,destination="local",onChange=()=>{}}={}){this.generation=dirty?1:0;this.saved=0;this.destination=destination;this.onChange=onChange;}
 get dirty(){return this.generation!==this.saved;}
 mark(){this.generation++;this.onChange(this);}
 checkpoint(){return this.generation;}
 confirm(generation,destination){if(generation!==this.generation)return false;this.saved=generation;this.destination=destination;this.onChange(this);return true;}
}
