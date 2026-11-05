/** RA-26: Google Workspace sign-in, chosen Drive folder, scoped backup and sharing. */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { connectGoogle, activeGoogleAccount, disconnectGoogle } from '../services/googleAuth';
import { checkDestination, driveFolderUrl, parseFolderId } from '../services/googleDriveApi';
import {
  backupAll, backupClass, backupStudent, backupSelectedRecordings, getDriveConfig, listDriveRecordings,
  saveDriveConfig, setAutomaticDriveBackup, shareRecordingById,
  type BackupProgress,
} from '../services/driveBackup';
import { listClasses, listStudents, type SchoolClass, type Student } from '../services';
import { onSchoolDataChanged } from '../services/syncEvents';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#3b82f6', paddingTop: 45, paddingBottom: 20, alignItems: 'center' },
  headerText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 48 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14 },
  sectionTitle: { color: '#94a3b8', fontWeight: '700', marginBottom: 15, letterSpacing: 1 },
  subheading: { color: '#4b5769', fontWeight: '700', marginBottom: 12, letterSpacing: 1, marginTop: 20 },
  description: { color: '#475569' },
  secondaryText: { color: '#64748b' },
  primaryButton: { backgroundColor: '#3b82f6', borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  input: { borderRadius: 12, backgroundColor: '#f1f5f9', padding: 14, marginVertical: 8, color: '#0f172a' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#ecf0f4' },
  selectedChip: { backgroundColor: '#dbeafe' },
  chipText: { color: '#0f172a', fontWeight: '600' },
  selectedChipText: { color: '#1d4ed8' },
  fileRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12,
    marginTop: 9, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc', gap: 12,
  },
  selectedFileRow: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  fileIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  fileIconText: { color: '#2563eb', fontSize: 12, fontWeight: '800' },
  fileName: { color: '#0f172a', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  fileSubtitle: { color: '#64748b', marginTop: 3, fontSize: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#b7c2d1', alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { borderColor: '#6f9eea', backgroundColor: '#6f9eea' },
  checkboxText: { color: '#fff', fontWeight: '800', fontSize: 15, lineHeight: 19 },
  choiceActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18, marginTop: 10 },
  choiceActionText: { color: '#3b82f6', fontWeight: '700' },
});

function Action({ title, disabled, onPress, backup = false }: {
  title: string;
  disabled?: boolean;
  onPress: () => void;
  backup?: boolean;
}) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, { marginTop: backup ? 12 : 8 }, disabled && styles.disabled]}
    >
      <Text style={styles.primaryButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

function RecordingChoice({ label, subtitle, selected, multiple = false, disabled, onPress }: {
  label: string;
  subtitle?: string;
  selected: boolean;
  multiple?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return <TouchableOpacity
    disabled={disabled} onPress={onPress} accessibilityRole={multiple ? 'checkbox' : 'radio'}
    accessibilityState={{ checked: selected, disabled }}
    style={[styles.fileRow, selected && styles.selectedFileRow, disabled && styles.disabled]}
  >
    <View style={styles.fileIcon}><Text style={styles.fileIconText}>WAV</Text></View>
    <View style={{ flex: 1 }}>
      <Text style={styles.fileName}>{label}</Text>
      {!!subtitle && <Text style={styles.fileSubtitle}>{subtitle}</Text>}
    </View>
    <View style={[styles.checkbox, !multiple && { borderRadius: 12 }, selected && styles.checkboxSelected]}>
      {selected && <Text style={styles.checkboxText}>{multiple ? '✓' : '●'}</Text>}
    </View>
  </TouchableOpacity>;
}

export default function GoogleDriveScreen() {
  const [account, setAccount] = useState<string | null>(null);
  const [folderInput, setFolderInput] = useState('');
  const [folder, setFolder] = useState('');
  const [automatic, setAutomatic] = useState(false);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  // Backup selection is multiple; sharing an individual recording still needs one student.
  const [shareStudentId, setShareStudentId] = useState<number | null>(null);
  const [recordings, setRecordings] = useState<{ id: number; label: string }[]>([]);
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const [backupRecordings, setBackupRecordings] = useState<Array<{ id: number; label: string; studentName: string; className: string }>>([]);
  const [selectedRecordingIds, setSelectedRecordingIds] = useState<number[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [recordingsError, setRecordingsError] = useState('');
  const [recipient, setRecipient] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const selectionInitialized = useRef(false);

  const loadSchool = async () => {
    const available = await listClasses();
    const groups = await Promise.all(available.map(c => listStudents(c.id)));
    const allStudents = groups.flat();
    setClasses(available);
    setStudents(allStudents);

    if (!selectionInitialized.current) {
      selectionInitialized.current = true;
      const firstClass = available[0];
      const firstStudent = allStudents.find(s => s.classId === firstClass?.id);
      setSelectedClassIds(firstClass ? [firstClass.id] : []);
      setSelectedStudentIds(firstStudent ? [firstStudent.id] : []);
    } else {
      setSelectedClassIds(ids => ids.filter(id => available.some(c => c.id === id)));
      setSelectedStudentIds(ids => ids.filter(id => allStudents.some(s => s.id === id)));
    }
  };

  const load = async () => {
    const [signedIn, cfg] = await Promise.all([activeGoogleAccount(), getDriveConfig()]);
    setAccount(signedIn);
    const correctAccount = signedIn && signedIn.toLowerCase() === cfg.accountEmail;
    setFolder(correctAccount ? cfg.folderId : '');
    setFolderInput(correctAccount ? cfg.folderId : '');
    setAutomatic(Boolean(correctAccount && cfg.automatic));
    await loadSchool();
  };

  useEffect(() => {
    void load().catch(error => console.warn('Drive setup:', error));
    return onSchoolDataChanged(() => { void loadSchool().catch(error => console.warn('Drive classes:', error)); });
  }, []);

  const availableStudents = students.filter(student => selectedClassIds.includes(student.classId));

  // Keep the pupil selection confined to classes that are currently selected.
  useEffect(() => {
    setSelectedStudentIds(ids => ids.filter(id => availableStudents.some(s => s.id === id)));
  }, [students, selectedClassIds]);

  useEffect(() => {
    setShareStudentId(current =>
      current !== null && selectedStudentIds.includes(current) ? current : (selectedStudentIds[0] ?? null));
  }, [selectedStudentIds]);

  useEffect(() => {
    let cancelled = false;
    setRecordings([]);
    setRecordingId(null);
    if (shareStudentId == null) return;
    void listDriveRecordings(shareStudentId).then(rows => {
      if (cancelled) return;
      setRecordings(rows);
      setRecordingId(rows[0]?.id ?? null);
    }).catch(error => console.warn('Drive recordings:', error));
    return () => { cancelled = true; };
  }, [shareStudentId]);

  // Backup list follows the selected students. The sharing list below remains single-choice.
  useEffect(() => {
    let cancelled = false;
    const chosen = students.filter(student => selectedStudentIds.includes(student.id));
    setBackupRecordings([]);
    setRecordingsError('');
    setRecordingsLoading(chosen.length > 0);
    if (!chosen.length) {
      setSelectedRecordingIds([]);
      return;
    }
    void Promise.all(chosen.map(async student => {
      const rows = await listDriveRecordings(student.id);
      return rows.map(row => ({
        ...row,
        studentName: `${student.firstName} ${student.lastName}`,
        className: classes.find(c => c.id === student.classId)?.name ?? '',
      }));
    })).then(groups => {
      if (cancelled) return;
      const rows = groups.flat();
      setBackupRecordings(rows);
      setSelectedRecordingIds(ids => ids.filter(id => rows.some(row => row.id === id)));
    }).catch(error => {
      if (!cancelled) setRecordingsError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (!cancelled) setRecordingsLoading(false);
    });
    return () => { cancelled = true; };
  }, [students, classes, selectedStudentIds]);

  const toggleRecording = (id: number) => setSelectedRecordingIds(ids =>
    ids.includes(id) ? ids.filter(current => current !== id) : [...ids, id]);

  const toggleClass = (id: number) => setSelectedClassIds(current =>
    current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const toggleStudent = (id: number) => setSelectedStudentIds(current =>
    current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  const act = async (fn: () => Promise<void>, label: string) => {
    if (busy) return;
    setBusy(true);
    setProgress(label);
    try { await fn(); }
    catch (error) { Alert.alert('Google Drive', error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); setProgress(''); }
  };

  const updateProgress = (p: BackupProgress) => setProgress(`${p.message} (${p.completed}/${p.total})`);
  const connected = Boolean(account && folder);
  const shareStudent = students.find(student => student.id === shareStudentId);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Cloudová záloha</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.description, { marginBottom: 14 }]}>
          Nahrávky zostávajú v telefóne. Do Drive sa nahrávajú len potvrdené WAV súbory.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>GOOGLE ÚČET</Text>
          <Text style={styles.description}>{account || 'Neprihlásený'}</Text>
          <Action title={account ? 'Zmeniť Google účet' : 'Prihlásiť sa cez Google'} disabled={busy}
            onPress={() => void act(async () => {
              if (account) {
                if (folder) await setAutomaticDriveBackup(false);
                await disconnectGoogle();
              }
              const selected = await connectGoogle();
              await load();
              if (selected) Alert.alert('Google', `Prihlásený účet: ${selected}`);
            }, 'Pripájanie účtu...')} />
          {!!account && <TouchableOpacity disabled={busy} onPress={() => void act(async () => {
            if (folder) await setAutomaticDriveBackup(false);
            await disconnectGoogle();
            setAccount(null); setFolder(''); setAutomatic(false);
          }, 'Odhlasovanie...')} style={{ marginTop: 12 }}>
            <Text style={{ color: '#b91c1c', textAlign: 'center' }}>Odhlásiť sa z Google</Text>
          </TouchableOpacity>}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>CIEĽOVÝ PRIEČINOK (Google Workspace / Shared Drive)</Text>
          <Text style={styles.secondaryText}>Skopírujte odkaz na priečinok z Google Drive. Účet musí mať právo pridávať súbory.</Text>
          <TextInput editable={Boolean(account) && !busy} value={folderInput} onChangeText={setFolderInput}
            autoCapitalize="none" autoCorrect={false} placeholder="https://drive.google.com/drive/folders/..."
            style={styles.input} />
          <Action title="Overiť a vybrať priečinok" disabled={!account || busy} onPress={() => void act(async () => {
            const id = parseFolderId(folderInput);
            const checked = await checkDestination(account!, id);
            await saveDriveConfig(account!, id, false);
            setFolder(id); setFolderInput(id); setAutomatic(false);
            Alert.alert('Priečinok nastavený', checked.name);
          }, 'Overovanie prístupu...')} />
          {!!folder && <TouchableOpacity onPress={() => void Linking.openURL(driveFolderUrl(folder))} style={{ marginTop: 12 }}>
            <Text style={{ color: '#3b82f6', fontWeight: '600' }}>Otvoriť vybraný priečinok na Drive</Text>
          </TouchableOpacity>}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>ZÁLOHOVANIE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ flex: 1, color: '#334155' }}>Automaticky zálohovať po uložení (pri internete)</Text>
            <Switch value={automatic} disabled={!connected || busy}
              trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
              thumbColor={automatic ? '#3b82f6' : '#f8fafc'}
              onValueChange={enabled => void act(async () => {
                await setAutomaticDriveBackup(enabled);
                setAutomatic(enabled);
                if (enabled) await backupAll(updateProgress);
              }, 'Aktualizácia zálohovania...')} />
          </View>
          <Text style={[styles.secondaryText, { marginTop: 7 }]}>
            Automatika je vypnutá, kým ju nepovolíte. Prebieha len počas otvorenej aplikácie; pri výpadku sa nahrávky odošlú po obnovení pripojenia.
          </Text>
          <Action backup title="Zálohovať všetky triedy" disabled={!connected || busy}
            onPress={() => void act(async () => {
              await backupAll(updateProgress);
              Alert.alert('Hotovo', 'Všetky triedy a nahrávky boli zálohované.');
            }, 'Príprava zálohy...')} />

          <Text style={styles.subheading}>Vybrať triedy ({selectedClassIds.length})</Text>
          <View style={styles.chipRow}>
            {classes.map(c => {
              const selected = selectedClassIds.includes(c.id);
              return <TouchableOpacity key={c.id} disabled={busy} accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }} onPress={() => toggleClass(c.id)}
                style={[styles.chip, selected && styles.selectedChip]}>
                <Text style={[styles.chipText, selected && styles.selectedChipText]}>
                  {selected ? '✓ ' : ''}{c.name}
                </Text>
              </TouchableOpacity>;
            })}
            {!classes.length && <Text style={styles.secondaryText}>Zatiaľ nie sú žiadne triedy.</Text>}
          </View>
          <Action backup title="Zálohovať vybrané triedy" disabled={!connected || busy || !selectedClassIds.length}
            onPress={() => void act(async () => {
              const chosen = classes.filter(c => selectedClassIds.includes(c.id));
              for (const [index, schoolClass] of chosen.entries()) {
                await backupClass(schoolClass.id, p => setProgress(
                  `${schoolClass.name} (${index + 1}/${chosen.length}): ${p.message} (${p.completed}/${p.total})`));
              }
              Alert.alert('Hotovo', 'Vybrané triedy boli zálohované.');
            }, 'Zálohovanie tried...')} />

          <Text style={styles.subheading}>Vybrať žiakov ({selectedStudentIds.length})</Text>
          <View style={styles.chipRow}>
            {availableStudents.map(s => {
              const selected = selectedStudentIds.includes(s.id);
              return <TouchableOpacity key={s.id} disabled={busy} accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }} onPress={() => toggleStudent(s.id)}
                style={[styles.chip, selected && styles.selectedChip]}>
                <Text style={[styles.chipText, selected && styles.selectedChipText]}>
                  {selected ? '✓ ' : ''}{s.firstName} {s.lastName}
                  {selectedClassIds.length > 1 ? ` · ${classes.find(c => c.id === s.classId)?.name ?? ''}` : ''}
                </Text>
              </TouchableOpacity>;
            })}
            {!availableStudents.length && <Text style={styles.secondaryText}>
              {selectedClassIds.length ? 'Vo vybraných triedach zatiaľ nie sú žiadni žiaci.' : 'Najprv vyberte triedu.'}
            </Text>}
          </View>
          <Action backup title="Zálohovať nahrávky vybraných žiakov"
            disabled={!connected || busy || !selectedStudentIds.length}
            onPress={() => void act(async () => {
              const chosen = availableStudents.filter(s => selectedStudentIds.includes(s.id));
              for (const [index, student] of chosen.entries()) {
                await backupStudent(student.classId, student.id, p => setProgress(
                  `${student.firstName} ${student.lastName} (${index + 1}/${chosen.length}): ${p.message} (${p.completed}/${p.total})`));
              }
              Alert.alert('Hotovo', 'Nahrávky vybraných žiakov boli zálohované.');
            }, 'Zálohovanie žiakov...')} />

          <Text style={styles.subheading}>Vybrať nahrávky ({selectedRecordingIds.length})</Text>
          <Text style={styles.secondaryText}>Označte konkrétne WAV súbory vybraných žiakov na zálohovanie.</Text>
          {recordingsLoading ? <ActivityIndicator color="#3b82f6" style={{ marginTop: 12 }} /> : <>
            {!!backupRecordings.length && <View style={styles.choiceActions}>
              <TouchableOpacity disabled={busy} onPress={() => setSelectedRecordingIds(backupRecordings.map(r => r.id))}>
                <Text style={styles.choiceActionText}>Vybrať všetky</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={busy} onPress={() => setSelectedRecordingIds([])}>
                <Text style={styles.choiceActionText}>Zrušiť výber</Text>
              </TouchableOpacity>
            </View>}
            {backupRecordings.map(r => <RecordingChoice key={r.id} label={r.label}
              subtitle={`${r.studentName}${selectedClassIds.length > 1 ? ` · ${r.className}` : ''}`}
              selected={selectedRecordingIds.includes(r.id)} multiple disabled={busy}
              onPress={() => toggleRecording(r.id)} />)}
            {!!recordingsError && <Text style={[styles.secondaryText, { marginTop: 12 }]}>{recordingsError}</Text>}
            {!backupRecordings.length && !recordingsError && <Text style={[styles.secondaryText, { marginTop: 12 }]}>
              {selectedStudentIds.length ? 'Vybraní žiaci zatiaľ nemajú uložené nahrávky.' : 'Najprv vyberte žiakov.'}
            </Text>}
          </>}
          <Action backup title="Zálohovať vybrané nahrávky"
            disabled={!connected || busy || recordingsLoading || !selectedRecordingIds.length}
            onPress={() => void act(async () => {
              await backupSelectedRecordings(selectedRecordingIds, updateProgress);
              Alert.alert('Hotovo', 'Vybrané nahrávky boli zálohované.');
            }, 'Zálohovanie nahrávok...')} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>4. Zdieľanie nahrávky s kolegom</Text>
          <Text style={styles.secondaryText}>Len konkrétny e-mail získa prístup na čítanie. Verejný odkaz sa nevytvorí.</Text>
          {selectedStudentIds.length > 1 && <>
            <Text style={styles.subheading}>Vybrať žiaka na zdieľanie</Text>
            <View style={styles.chipRow}>
              {students.filter(s => selectedStudentIds.includes(s.id)).map(s => (
                <TouchableOpacity key={s.id} disabled={busy} onPress={() => setShareStudentId(s.id)}
                  style={[styles.chip, shareStudentId === s.id && styles.selectedChip]}>
                  <Text style={[styles.chipText, shareStudentId === s.id && styles.selectedChipText]}>
                    {s.firstName} {s.lastName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>}
          {shareStudent ? <Text style={[styles.description, { marginTop: 14, marginBottom: 4 }]}>
            Nahrávky žiaka: {shareStudent.firstName} {shareStudent.lastName}
          </Text> : <Text style={[styles.secondaryText, { marginTop: 12 }]}>
            Pre zdieľanie najprv vyberte žiaka v časti 3.
          </Text>}
          {recordings.map(r => <RecordingChoice key={r.id} label={r.label}
            selected={recordingId === r.id} disabled={busy}
            onPress={() => setRecordingId(r.id)} />)}
          {shareStudent && !recordings.length && <Text style={[styles.secondaryText, { marginTop: 10 }]}>
            Tento žiak zatiaľ nemá uložené nahrávky.
          </Text>}
          <TextInput editable={!busy} value={recipient} onChangeText={setRecipient}
            placeholder="kolega@skola.sk" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          <Action title="Zdieľať vybranú nahrávku" disabled={!connected || busy || recordingId == null || !recipient.trim()}
            onPress={() => void act(async () => {
              const url = await shareRecordingById(recordingId!, recipient.trim());
              Alert.alert('Zdieľané', `Kolega dostal prístup.\n${url}`);
            }, 'Nahrávanie a zdieľanie...')} />
        </View>

        {busy && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator color="#3b82f6" /><Text style={{ color: '#334155', flex: 1 }}>{progress}</Text>
        </View>}
        <Text style={[styles.secondaryText, { fontSize: 12, marginTop: 8 }]}>
          Zálohy neodstraňujú súbory zo zariadenia ani z Drive. Poznámky žiakov sa do cloudu neprenášajú.
        </Text>
      </ScrollView>
    </View>
  );
}
