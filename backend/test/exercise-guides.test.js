import test from 'node:test';
import assert from 'node:assert/strict';
import {exerciseData} from '../src/data/exercise-catalog.js';
import {exerciseGuides} from '../src/data/exercise-guides.js';
import exerciseVideos from '../src/data/exercise-videos.json' with {type:'json'};
import {exerciseVideoPattern} from '../src/services/exercise-video-url.js';
test('guías: cubren exactamente los 190 ejercicios y sus variantes',()=>{
  assert.equal(exerciseData.length,190);
  assert.deepEqual(Object.keys(exerciseGuides).sort(),exerciseData.map(e=>e.name).sort());
  for(const exercise of exerciseData){
    assert.ok(exercise.description.length>=50&&exercise.description.length<=400,exercise.name);
    assert.ok(!/[\u3040-\u30ff]/.test(exercise.description),exercise.name);
    assert.ok(exerciseVideoPattern.test(exercise.videoUrl));
    assert.ok(exerciseVideos[exercise.name].title.length>8);
  }
});

test('videos: permite enlaces directos y rechaza búsquedas y dominios falsos',()=>{
  for(const url of ['https://www.youtube.com/shorts/JZA1_vAc7go','https://www.youtube.com/watch?v=JZA1_vAc7go','https://youtu.be/JZA1_vAc7go','https://www.tiktok.com/@example/video/123'])assert.ok(exerciseVideoPattern.test(url),url);
  for(const url of ['javascript:alert(1)','https://www.youtube.com.evil.invalid/shorts/JZA1_vAc7go','https://evil.invalid/?youtube.com','https://www.youtube.com/results?search_query=sentadilla','https://www.youtube.com/@example','https://www.youtube.com/shorts/invalid','http://www.youtube.com/shorts/JZA1_vAc7go'])assert.equal(exerciseVideoPattern.test(url),false,url);
});
