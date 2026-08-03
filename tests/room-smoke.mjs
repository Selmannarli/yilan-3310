const api=process.env.SHOT_ROOM_API||"https://shot-room-server.selman-narli.workers.dev";
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function createPlayers(count){
  const room=await fetch(`${api}/rooms`,{method:"POST"}).then(response=>response.json()),states=new Map(),clients=[];
  for(let index=0;index<count;index++)clients.push(await new Promise((resolve,reject)=>{const name=`Test${index+1}`,ws=new WebSocket(`${api.replace("https","wss")}/rooms/${room.code}/connect?nickname=${name}&avatar=${index}`);ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.type==="welcome"){states.set(name,message.state);resolve({ws,id:message.playerId,name});}if(message.type==="state")states.set(name,message.state);};ws.onerror=reject;}));
  await delay(350);return {room,states,clients};
}
const send=(client,message)=>client.ws.send(JSON.stringify(message));
const digitalCards=game=>Array.from({length:10},(_,index)=>({id:9000+index,kind:"digital",game,level:"normal"}));

async function testXoxSpectators(){
  const {room,states,clients}=await createPlayers(3),[host,opponent,spectator]=clients;
  send(host,{type:"configure",categories:["digital"]});send(host,{type:"start",cards:digitalCards("xox")});await delay(300);send(host,{type:"revealCard"});await delay(250);send(host,{type:"selectMiniOpponent",opponentId:opponent.id});await delay(200);send(host,{type:"miniReady"});send(opponent,{type:"miniReady"});await delay(3300);
  let state=states.get(host.name),turn=state.miniGame?.challenge?.currentTurnId,mover=clients.find(client=>client.id===turn);if(!mover)throw new Error(`XOX did not start: ${JSON.stringify(state.miniGame)}`);send(mover,{type:"miniAction",action:"move",value:4});await delay(300);state=states.get(spectator.name);const board=state.miniGame.challenge.board;
  if(state.miniGame.participantIds.includes(spectator.id)||board[4]===null)throw new Error(`XOX spectator sync failed: ${JSON.stringify({code:room.code,board,participants:state.miniGame.participantIds})}`);
  send(host,{type:"cancelMini"});await delay(150);send(host,{type:"confirmMini"});await delay(200);state=states.get(host.name);clients.forEach(client=>client.ws.close());return {code:room.code,game:"xox",spectatorSynced:true,confirmed:state.confirmed};
}

async function testCommonAnswer(){
  const {room,states,clients}=await createPlayers(3),host=clients[0];send(host,{type:"configure",categories:["digital"]});send(host,{type:"start",cards:digitalCards("common_answer")});await delay(300);send(host,{type:"revealCard"});await delay(250);clients.forEach(client=>send(client,{type:"miniReady"}));await delay(3300);let state=states.get(host.name),choice=state.miniGame.challenge.options[0];send(clients[0],{type:"miniAction",action:"answer",value:choice});await delay(150);state=states.get(clients[1].name);if(Object.keys(state.miniGame.submissions).length)throw new Error("Secret answers leaked before result");send(clients[1],{type:"miniAction",action:"answer",value:choice});send(clients[2],{type:"miniAction",action:"answer",value:choice});await delay(250);state=states.get(host.name);if(state.miniGame.phase!=="result"||state.miniGame.losers.length)throw new Error(`Common answer result failed: ${JSON.stringify(state.miniGame)}`);send(host,{type:"confirmMini"});await delay(200);state=states.get(host.name);clients.forEach(client=>client.ws.close());return {code:room.code,game:"common_answer",secret:true,confirmed:state.confirmed};
}

const results=[await testXoxSpectators(),await testCommonAnswer()];
console.log(JSON.stringify(results));
