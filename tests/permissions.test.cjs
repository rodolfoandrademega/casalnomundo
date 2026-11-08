const {test}=require('node:test');
const assert=require('node:assert/strict');
const {access}=require('../permissions');
test('native access includes JSON transfer and user management regardless of member settings',()=>{
 const native=access({native:true,active:false});assert(native.native);assert(native.can('users'));assert(native.can('reports'));
 assert.deepEqual(native.patch({profile:{name:'new'},stays:[]},{profile:{name:'old'}}),{profile:{name:'new'},stays:[]});
});
test('limited access only edits granted sections and excludes JSON/user management',()=>{
 const editor=access({active:true,permissions:['profile','socials','import']});
 assert(!editor.native);assert(!editor.can('users'));assert(!editor.can('import'));assert(!editor.can('overview'));assert.equal(editor.firstView(),'profile');
 assert.deepEqual(editor.patch({profile:{name:'new'},stays:[],contact:{url:'new'},socials:[]},{profile:{name:'old'}}),{profile:{name:'new'},contact:{url:'new'},socials:[]});
});
test('reports access does not grant editing and disabled accounts lose access',()=>{
 assert(access({active:true,permissions:['reports']}).can('overview'));
 assert.deepEqual(access({active:true,permissions:['reports']}).patch({profile:{}},{}),{});
 assert.equal(access({active:false,permissions:['profile']}).firstView(),undefined);
 assert.equal(access().firstView(),undefined);
});

test('Create users opens registration without native-only privileges',()=>{
 const manager=access({active:true,permissions:['users','profile']});
 assert(manager.can('users'));assert(!manager.native);assert(!manager.can('reports'));
 assert.equal(access({active:true,permissions:['users']}).firstView(),'users');
 assert.deepEqual(manager.patch({users:['anything'],profile:{name:'new'}},{}),{profile:{name:'new'}});
});
