import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { clearServerToken, getServerToken, saveServerToken } from '../services/serverAuth';
import { synchronizeSchool } from '../services/schoolSync';

export default function SyncControls({onSynced}: {onSynced:()=>Promise<void>}) {
  const [configured,setConfigured] = useState(false);
  const [token,setToken] = useState('');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  useEffect(() => { void getServerToken().then(v=>setConfigured(Boolean(v))).catch(e=>setMessage(String(e))); }, []);
  const run = async () => {
    if (busy) return;
    setBusy(true);setMessage('');
    try {
      if (!configured) { await saveServerToken(token);setConfigured(true);setToken(''); }
      await synchronizeSchool();
      await onSynced();
      setMessage('Synchronizácia dokončená.');
    } catch (e) { setMessage(e instanceof Error?e.message:String(e)); }
    finally { setBusy(false); }
  };
  return <View style={{backgroundColor:'white',padding:14,borderRadius:16,marginBottom:16}}>
    <Text style={{fontWeight:'700',marginBottom:8}}>Vzdialená synchronizácia</Text>
    {!configured && <TextInput secureTextEntry autoCapitalize="none" autoCorrect={false}
      placeholder="Prístupový kľúč servera" value={token} onChangeText={setToken}
      style={{backgroundColor:'#eef2ff',padding:12,borderRadius:8,marginBottom:8}}/>}
    <TouchableOpacity disabled={busy} onPress={()=>{void run();}}
      style={{backgroundColor:'#3b82f6',padding:12,borderRadius:10}}>
      <Text style={{color:'white',textAlign:'center'}}>{busy?'Synchronizujem…':'Synchronizovať'}</Text>
    </TouchableOpacity>
    {configured && <TouchableOpacity onPress={()=>{void clearServerToken().then(()=>{setConfigured(false);setMessage('');});}}>
      <Text style={{color:'#64748b',marginTop:10}}>Zmeniť prístupový kľúč</Text>
    </TouchableOpacity>}
    {!!message && <Text style={{marginTop:8,color:message.includes('dokončená')?'#166534':'#b91c1c'}}>{message}</Text>}
  </View>;
}
