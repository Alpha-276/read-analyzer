import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { getStudentNote, saveStudentNote } from '../services/studentNotes';
import { onSchoolDataChanged } from '../services/syncEvents';
import {
  addStudent as addStudentToDb,
  createClass as createClassInDb,
  deleteClass as deleteClassFromDb,
  deleteStudent as deleteStudentFromDb,
  listClasses,
  listStudents,
  renameClass as renameClassInDb,
  updateStudent as updateStudentInDb,
  type SchoolClass,
  type Student,
} from '../services';

export default function ClassScreen() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);

  const [newClassName, setNewClassName] = useState('');
  const [renamingClass, setRenamingClass] = useState<SchoolClass | null>(null);
  const [renamedClassName, setRenamedClassName] = useState('');
  const [savingClass, setSavingClass] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<number | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [noteStudentId, setNoteStudentId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const loadStudents = async () => {
    try {
      const all = await listClasses();
      setClasses(all);
      const classId = all.some(c => c.id === selectedClassId)
        ? selectedClassId
        : (all[0]?.id ?? null);
      if (classId !== selectedClassId) setSelectedClassId(classId);
      setStudents(classId == null ? [] : await listStudents(classId));
    } catch (error) {
      console.error('Failed to load classes and students:', error);
    }
  };

  useEffect(() => {
    void loadStudents();
    return onSchoolDataChanged(() => { void loadStudents(); });
  }, [selectedClassId]);

  const createClass = async () => {
    if (!newClassName.trim()) return;
    try {
      const created = await createClassInDb(newClassName);
      setNewClassName('');
      setSelectedClassId(created.id);
    } catch (error) {
      Alert.alert('Chyba', error instanceof Error ? error.message : String(error));
    }
  };

  const openRenameClass = (schoolClass: SchoolClass) => {
    setRenamingClass(schoolClass);
    setRenamedClassName(schoolClass.name);
  };

  const saveRenamedClass = async () => {
    if (!renamingClass || !renamedClassName.trim() || savingClass) return;
    setSavingClass(true);
    try {
      await renameClassInDb(renamingClass.id, renamedClassName);
      setRenamingClass(null);
      setRenamedClassName('');
      await loadStudents();
    } catch (error) {
      Alert.alert('Chyba', error instanceof Error ? error.message : String(error));
    } finally {
      setSavingClass(false);
    }
  };

  const removeClass = async (id: number) => {
    if (deletingClassId !== null) return;
    setDeletingClassId(id);
    try {
      await deleteClassFromDb(id);
      if (selectedClassId === id) {
        setEditingId(null);
        setFirstName('');
        setLastName('');
      }
      await loadStudents();
    } catch (error) {
      Alert.alert('Chyba', 'Triedu sa nepodarilo odstrániť. Skúste to znova.');
      console.error('Failed to delete class:', error);
    } finally {
      setDeletingClassId(null);
    }
  };

  const confirmDeleteClass = (schoolClass: SchoolClass) => {
    Alert.alert(
      'Odstrániť triedu?',
      `Naozaj chcete odstrániť triedu „${schoolClass.name}“ aj všetkých jej žiakov?\n\nUložené WAV nahrávky zostanú zachované.`,
      [
        { text: 'Zrušiť', style: 'cancel' },
        { text: 'Odstrániť', style: 'destructive', onPress: () => { void removeClass(schoolClass.id); } },
      ],
    );
  };

  const addStudent = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    if (selectedClassId == null) {
      Alert.alert('Trieda', 'Najprv pridajte triedu.');
      return;
    }
    try {
      await addStudentToDb({ classId: selectedClassId, firstName, lastName });
      setFirstName('');
      setLastName('');
      await loadStudents();
    } catch (error) {
      Alert.alert('Chyba', error instanceof Error ? error.message : String(error));
    }
  };

  const deleteStudent = async (id: number) => {
    if (deletingId !== null) return;
    setDeletingId(id);
    try {
      await deleteStudentFromDb(id);
      setStudents(current => current.filter(student => student.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setFirstName('');
        setLastName('');
      }
    } catch (error) {
      Alert.alert('Chyba', 'Žiaka sa nepodarilo odstrániť. Skúste to znova.');
      console.error('Failed to delete student:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDeleteStudent = (student: Student) => {
    Alert.alert(
      'Odstrániť žiaka?',
      `Naozaj chcete odstrániť žiaka ${student.firstName} ${student.lastName} zo zoznamu?\n\nUložené WAV nahrávky v priečinku Download/CitamDobre zostanú zachované.`,
      [
        { text: 'Zrušiť', style: 'cancel' },
        { text: 'Odstrániť', style: 'destructive', onPress: () => { void deleteStudent(student.id); } },
      ],
    );
  };

  const editStudent = (id: number) => {
    const student = students.find(s => s.id === id);
    if (!student) return;
    setFirstName(student.firstName);
    setLastName(student.lastName);
    setEditingId(id);
  };

  const updateStudent = async () => {
    if (editingId === null || !firstName.trim() || !lastName.trim()) return;
    try {
      await updateStudentInDb(editingId, { firstName, lastName });
      setEditingId(null);
      setFirstName('');
      setLastName('');
      await loadStudents();
    } catch (error) {
      Alert.alert('Chyba', error instanceof Error ? error.message : String(error));
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setFirstName('');
    setLastName('');
  };

  const editNote = async (id: number) => {
    try {
      setNoteText(await getStudentNote(id));
      setNoteStudentId(id);
    } catch (error) {
      Alert.alert('Chyba', String(error));
    }
  };

  const storeNote = async () => {
    if (noteStudentId == null || savingNote) return;
    setSavingNote(true);
    try {
      await saveStudentNote(noteStudentId, noteText);
      setNoteStudentId(null);
      setNoteText('');
    } catch (error) {
      Alert.alert('Chyba', String(error));
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Manažment triedy</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>TRIEDY ({classes.length})</Text>

          {classes.length === 0 ? (
            <Text style={styles.emptyText}>Zatiaľ nie sú žiadne triedy.</Text>
          ) : (
            <View style={styles.classList}>
              {classes.map(schoolClass => (
                <View key={schoolClass.id} style={[
                  styles.classRow,
                  selectedClassId === schoolClass.id && styles.selectedClassRow,
                ]}>
                  <TouchableOpacity
                    onPress={() => {
                      if (selectedClassId !== schoolClass.id) cancelEditing();
                      setSelectedClassId(schoolClass.id);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Vybrať triedu ${schoolClass.name}`}
                    style={styles.classSelect}
                  >
                    <Text style={[
                      styles.className,
                      selectedClassId === schoolClass.id && styles.selectedClassName,
                    ]}>{schoolClass.name}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => openRenameClass(schoolClass)}
                    accessibilityRole="button"
                    accessibilityLabel={`Premenovať triedu ${schoolClass.name}`}
                    style={styles.editIconButton}
                  >
                    <Text>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmDeleteClass(schoolClass)}
                    disabled={deletingClassId !== null}
                    accessibilityRole="button"
                    accessibilityLabel={`Odstrániť triedu ${schoolClass.name}`}
                    style={[styles.deleteIconButton, deletingClassId !== null && styles.disabledButton]}
                  >
                    <Text>{deletingClassId === schoolClass.id ? '…' : '🗑️'}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TextInput
            placeholder="Názov novej triedy"
            value={newClassName}
            onChangeText={setNewClassName}
            style={styles.input}
          />
          <TouchableOpacity onPress={() => { void createClass(); }} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>+ Pridať</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {editingId !== null ? 'UPRAVIŤ ŽIAKA' : 'PRIDAŤ ŽIAKA'}
          </Text>
          <TextInput placeholder="Meno" value={firstName} onChangeText={setFirstName} style={styles.input} />
          <TextInput placeholder="Priezvisko" value={lastName} onChangeText={setLastName} style={styles.input} />
          <TouchableOpacity
            onPress={() => { void (editingId !== null ? updateStudent() : addStudent()); }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              {editingId !== null ? '💾 Uložiť zmeny' : '＋ Pridať'}
            </Text>
          </TouchableOpacity>
          {editingId !== null && (
            <TouchableOpacity onPress={cancelEditing} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Zrušiť úpravu</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.studentsTitle}>ŽIACI V TRIEDE ({students.length})</Text>
        {students.length === 0 ? (
          <Text style={styles.emptyText}>V tejto triede zatiaľ nie sú žiadni žiaci.</Text>
        ) : students.map((student, index) => (
          <View key={student.id} style={styles.studentRow}>
            <View style={styles.studentNumber}>
              <Text style={styles.studentNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.studentName}>{student.firstName} {student.lastName}</Text>
            <TouchableOpacity
              onPress={() => { void editNote(student.id); }}
              accessibilityRole="button"
              accessibilityLabel={`Poznámka žiaka ${student.firstName} ${student.lastName}`}
              style={styles.noteIconButton}
            ><Text>📝</Text></TouchableOpacity>
            <TouchableOpacity
              onPress={() => editStudent(student.id)}
              accessibilityRole="button"
              accessibilityLabel={`Upraviť žiaka ${student.firstName} ${student.lastName}`}
              style={styles.editIconButton}
            ><Text>✏️</Text></TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmDeleteStudent(student)}
              disabled={deletingId !== null}
              accessibilityRole="button"
              accessibilityLabel={`Odstrániť žiaka ${student.firstName} ${student.lastName}`}
              style={[styles.deleteIconButton, deletingId !== null && styles.disabledButton]}
            ><Text>{deletingId === student.id ? '…' : '🗑️'}</Text></TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={renamingClass !== null} transparent animationType="fade"
        onRequestClose={() => { if (!savingClass) setRenamingClass(null); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Premenovať triedu</Text>
            <TextInput
              value={renamedClassName}
              onChangeText={setRenamedClassName}
              placeholder="Názov triedy"
              autoFocus
              style={styles.modalInput}
            />
            <TouchableOpacity
              disabled={savingClass || !renamedClassName.trim()}
              onPress={() => { void saveRenamedClass(); }}
              style={[styles.primaryButton, (savingClass || !renamedClassName.trim()) && styles.disabledButton]}
            ><Text style={styles.primaryButtonText}>Uložiť zmeny</Text></TouchableOpacity>
            <TouchableOpacity disabled={savingClass} onPress={() => setRenamingClass(null)} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Zrušiť</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={noteStudentId !== null} transparent animationType="slide"
        onRequestClose={() => setNoteStudentId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Poznámka k žiakovi</Text>
            <TextInput multiline value={noteText} onChangeText={setNoteText}
              placeholder="Textová poznámka"
              style={styles.noteInput} />
            <TouchableOpacity disabled={savingNote} onPress={() => { void storeNote(); }}
              style={[styles.primaryButton, savingNote && styles.disabledButton]}>
              <Text style={styles.primaryButtonText}>Uložiť poznámku</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setNoteStudentId(null)} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Zrušiť</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#3b82f6', paddingTop: 45, paddingBottom: 20, alignItems: 'center' },
  headerText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 60 },
  card: {
    backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  sectionTitle: { color: '#94a3b8', fontWeight: '700', marginBottom: 15, letterSpacing: 1 },
  classList: { gap: 8, marginBottom: 15 },
  classRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9',
    borderRadius: 14, padding: 7,
  },
  selectedClassRow: { backgroundColor: '#dbeafe' },
  classSelect: { flex: 1, minHeight: 36, justifyContent: 'center', paddingHorizontal: 8 },
  className: { color: '#0f172a', fontWeight: '600', fontSize: 16 },
  selectedClassName: { color: '#1d4ed8' },
  input: { backgroundColor: '#eef2ff', borderRadius: 14, padding: 16, marginBottom: 12 },
  primaryButton: { backgroundColor: '#3b82f6', borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelButton: { marginTop: 10, alignItems: 'center', padding: 6 },
  cancelText: { color: '#64748b' },
  studentsTitle: { color: '#94a3b8', fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  studentRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    borderRadius: 20, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  studentNumber: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  studentNumberText: { color: 'white', fontWeight: '700', fontSize: 17 },
  studentName: { flex: 1, fontSize: 17, fontWeight: '600', color: '#0f172a', marginRight: 6 },
  noteIconButton: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#f0fdf4',
    justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  editIconButton: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  deleteIconButton: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#fef2f2',
    justifyContent: 'center', alignItems: 'center',
  },
  disabledButton: { opacity: 0.5 },
  emptyText: { color: '#64748b', fontSize: 15, marginBottom: 16 },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: '#0008', padding: 20 },
  modalCard: { backgroundColor: 'white', padding: 16, borderRadius: 16 },
  modalTitle: { color: '#0f172a', fontWeight: '700', fontSize: 18, marginBottom: 12 },
  modalInput: { backgroundColor: '#eef2ff', borderRadius: 14, padding: 16, marginBottom: 12 },
  noteInput: {
    backgroundColor: '#eef2ff', borderRadius: 10, padding: 12,
    minHeight: 100, maxHeight: 240, textAlignVertical: 'top', marginBottom: 10,
  },
});
