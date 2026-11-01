import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canShowHeroFog,isSoftwareRenderer} from '../src/lib/shaderBudget.js';

test('software renderers are recognised and real GPUs are not',()=>{
 for(const name of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)','llvmpipe (LLVM 15.0.7, 256 bits)','Microsoft Basic Render Driver'])assert.equal(isSoftwareRenderer(name),true,name);
 for(const name of ['ANGLE (Apple, ANGLE Metal Renderer: Apple M6, Unspecified Version)','Adreno (TM) 730','Mali-G78','Apple GPU',undefined])assert.equal(isSoftwareRenderer(name),false,String(name));
});

test('the hero Fog needs a wide screen, no data saver and a working WebGPU adapter',async()=>{
 const gpu={requestAdapter:async()=>({})};
 assert.equal(await canShowHeroFog({wide:true,saveData:false,gpu}),true);
 assert.equal(await canShowHeroFog({wide:false,saveData:false,gpu}),false);
 assert.equal(await canShowHeroFog({wide:true,saveData:true,gpu}),false);
 assert.equal(await canShowHeroFog({wide:true,saveData:false,gpu:undefined}),false);
 assert.equal(await canShowHeroFog({wide:true,saveData:false,gpu:{requestAdapter:async()=>null}}),false);
 assert.equal(await canShowHeroFog({wide:true,saveData:false,gpu:{requestAdapter:async()=>{throw new Error('blocked');}}}),false);
});
