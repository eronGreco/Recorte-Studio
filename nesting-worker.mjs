import {nestPieces} from './nesting.mjs';
self.onmessage=({data})=>{try{const result=nestPieces(data,p=>self.postMessage({progress:p}));self.postMessage({result});}catch(e){self.postMessage({error:e.message});}};
