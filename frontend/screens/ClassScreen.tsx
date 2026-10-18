import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
} from "react-native";

import { useEffect, useState } from "react";

import {
    listStudents,
    addStudent as addStudentToDb,
    updateStudent as updateStudentInDb,
} from "../services";

export default function ClassScreen() {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        try {
            const data = await listStudents(1);
            setStudents(data);
        } catch (error) {
            console.error(error);
        }
    };

    const [editingId, setEditingId] =
        useState<number | null>(null);

    const [students, setStudents] = useState<any[]>([]);

    const addStudent = async () => {
        if (!firstName.trim() || !lastName.trim()) {
            return;
        }

        try {
            await addStudentToDb({
                classId: 1,
                firstName,
                lastName,
            });

            await loadStudents();

            setFirstName("");
            setLastName("");
        } catch (error) {
            console.error(error);
        }
    };

    const deleteStudent = (id: number) => {
        setStudents(
            students.filter(
                (student) => student.id !== id
            )
        );

        if (editingId === id) {
            setEditingId(null);
            setFirstName("");
            setLastName("");
        }
    };

    const editStudent = (id: number) => {
        const student = students.find(
            (s) => s.id === id
        );

        if (!student) return;


        setFirstName(student.firstName);
        setLastName(student.lastName);
        setEditingId(id);
    };

    const updateStudent = async () => {
        if (
            editingId === null ||
            !firstName.trim() ||
            !lastName.trim()
        ) {
            return;
        }

        try {
            await updateStudentInDb(
                editingId,
                {
                    firstName,
                    lastName,
                }
            );

            await loadStudents();

            setEditingId(null);
            setFirstName("");
            setLastName("");
        } catch (error) {
            console.error(error);
        }
    };

    const cancelEditing = () => {
        setEditingId(null);
        setFirstName("");
        setLastName("");
    };

    return (
        <View
            style={{
                flex: 1,
                backgroundColor: "#f1f5f9",
            }}
        >
            <View
                style={{
                    backgroundColor: "#3b82f6",
                    paddingTop: 45,
                    paddingBottom: 20,
                    alignItems: "center",
                }}
            >
                <Text
                    style={{
                        color: "white",
                        fontSize: 24,
                        fontWeight: "700",
                    }}
                >
                    ČítamDobre
                </Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    padding: 16,
                    paddingBottom: 60,
                }}
            >
                <Text
                    style={{
                        fontSize: 30,
                        fontWeight: "700",
                        color: "#0f172a",
                        marginBottom: 6,
                    }}
                >
                    Manažment triedy
                </Text>

                <Text
                    style={{
                        color: "#64748b",
                        marginBottom: 20,
                    }}
                >
                    {students.length} žiakov v triede
                </Text>

                <View
                    style={{
                        backgroundColor: "white",
                        borderRadius: 20,
                        padding: 16,
                        marginBottom: 20,

                        shadowColor: "#000",
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                        elevation: 3,
                    }}
                >
                    <Text
                        style={{
                            color: "#94a3b8",
                            fontWeight: "700",
                            marginBottom: 15,
                            letterSpacing: 1,
                        }}
                    >
                        {editingId
                            ? "UPRAVIŤ ŽIAKA"
                            : "PRIDAŤ ŽIAKA"}
                    </Text>

                    <TextInput
                        placeholder="Meno"
                        value={firstName}
                        onChangeText={setFirstName}
                        style={{
                            backgroundColor: "#eef2ff",
                            borderRadius: 14,
                            padding: 16,
                            marginBottom: 12,
                        }}
                    />

                    <TextInput
                        placeholder="Priezvisko"
                        value={lastName}
                        onChangeText={setLastName}
                        style={{
                            backgroundColor: "#eef2ff",
                            borderRadius: 14,
                            padding: 16,
                            marginBottom: 15,
                        }}
                    />

                    <TouchableOpacity
                        onPress={
                            editingId !== null
                                ? updateStudent
                                : addStudent
                        }
                        style={{
                            backgroundColor: "#3b82f6",
                            borderRadius: 14,
                            padding: 16,
                            alignItems: "center",
                        }}
                    >
                        <Text
                            style={{
                                color: "white",
                                fontSize: 16,
                                fontWeight: "700",
                            }}
                        >
                            {editingId !== null
                                ? "💾 Uložiť zmeny"
                                : "＋ Pridať"}
                        </Text>
                    </TouchableOpacity>

                    {editingId !== null && (
                        <TouchableOpacity
                            onPress={cancelEditing}
                            style={{
                                marginTop: 10,
                                alignItems: "center",
                            }}
                        >
                            <Text
                                style={{
                                    color: "#64748b",
                                }}
                            >
                                Zrušiť úpravu
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                <Text
                    style={{
                        color: "#94a3b8",
                        fontWeight: "700",
                        letterSpacing: 1,
                        marginBottom: 12,
                    }}
                >
                    ŽIACI V TRIEDE
                </Text>

                {students.map((student) => (
                    <View
                        key={student.id}
                        style={{
                            backgroundColor: "white",
                            borderRadius: 20,
                            padding: 14,
                            marginBottom: 12,

                            shadowColor: "#000",
                            shadowOpacity: 0.06,
                            shadowRadius: 8,
                            elevation: 3,

                            flexDirection: "row",
                            alignItems: "center",
                        }}
                    >
                        <View
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: "#3b82f6",
                                justifyContent: "center",
                                alignItems: "center",
                                marginRight: 12,
                            }}
                        >
                            <Text
                                style={{
                                    color: "white",
                                    fontWeight: "700",
                                    fontSize: 12,
                                }}
                            >
                                {student.firstName.charAt(0)}
                                {student.lastName.charAt(0)}
                            </Text>
                        </View>

                        <View
                            style={{
                                flex: 1,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 16,
                                    fontWeight: "600",
                                    color: "#0f172a",
                                }}
                            >
                                {student.firstName} {student.lastName}
                            </Text>

                            <Text
                                style={{
                                    color: "#64748b",
                                    marginTop: 2,
                                }}
                            >
                                Žiak #{student.id}
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={() =>
                                editStudent(student.id)
                            }
                            style={{
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: "#eff6ff",
                                justifyContent: "center",
                                alignItems: "center",
                                marginRight: 8,
                            }}
                        >
                            <Text>✏️</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() =>
                                deleteStudent(student.id)
                            }
                            style={{
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: "#fef2f2",
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <Text>🗑️</Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}