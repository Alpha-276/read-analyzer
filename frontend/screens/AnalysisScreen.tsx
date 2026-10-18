import {
    View,
    Text,
    ScrollView,
} from "react-native";

export default function AnalysisScreen() {
    return (
        <ScrollView
            style={{
                flex: 1,
                backgroundColor: "#f1f5f9",
                padding: 16,
            }}
        >
            <Text
                style={{
                    fontSize: 30,
                    fontWeight: "700",
                    color: "#0f172a",
                    marginTop: 20,
                }}
            >
                Analýza čítania
            </Text>

            <Text
                style={{
                    color: "#64748b",
                    marginTop: 6,
                    marginBottom: 20,
                }}
            >
                Jana Novotná · T01 · 16.10.2026
            </Text>

            <View
                style={{
                    flexDirection: "row",
                    gap: 10,
                    marginBottom: 10,
                }}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "white",
                        borderRadius: 20,
                        padding: 16,
                    }}
                >
                    <Text>Presnosť</Text>
                    <Text
                        style={{
                            fontSize: 28,
                            fontWeight: "700",
                        }}
                    >
                        94 %
                    </Text>
                </View>

                <View
                    style={{
                        flex: 1,
                        backgroundColor: "white",
                        borderRadius: 20,
                        padding: 16,
                    }}
                >
                    <Text>Rýchlosť</Text>
                    <Text
                        style={{
                            fontSize: 28,
                            fontWeight: "700",
                        }}
                    >
                        78
                    </Text>
                    <Text>sl/min</Text>
                </View>
            </View>

            <View
                style={{
                    flexDirection: "row",
                    gap: 10,
                    marginBottom: 10,
                }}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "white",
                        borderRadius: 20,
                        padding: 16,
                    }}
                >
                    <Text>Správne slová</Text>
                    <Text
                        style={{
                            fontSize: 28,
                            fontWeight: "700",
                            color: "#22c55e",
                        }}
                    >
                        20
                    </Text>
                </View>

                <View
                    style={{
                        flex: 1,
                        backgroundColor: "white",
                        borderRadius: 20,
                        padding: 16,
                    }}
                >
                    <Text>Nesprávne slová</Text>
                    <Text
                        style={{
                            fontSize: 28,
                            fontWeight: "700",
                            color: "#f97316",
                        }}
                    >
                        1
                    </Text>
                </View>
            </View>

            <View
                style={{
                    flexDirection: "row",
                    gap: 10,
                    marginBottom: 20,
                }}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "white",
                        borderRadius: 20,
                        padding: 16,
                    }}
                >
                    <Text>Vynechania</Text>
                    <Text
                        style={{
                            fontSize: 28,
                            fontWeight: "700",
                            color: "#ef4444",
                        }}
                    >
                        1
                    </Text>
                </View>

                <View
                    style={{
                        flex: 1,
                        backgroundColor: "white",
                        borderRadius: 20,
                        padding: 16,
                    }}
                >
                    <Text>Pridania</Text>
                    <Text
                        style={{
                            fontSize: 28,
                            fontWeight: "700",
                            color: "#64748b",
                        }}
                    >
                        0
                    </Text>
                </View>
            </View>

            <View
                style={{
                    backgroundColor: "white",
                    borderRadius: 20,
                    padding: 20,
                    marginTop: 10,
                }}
            >
                <Text
                    style={{
                        fontWeight: "700",
                        marginBottom: 10,
                    }}
                >
                    Porovnanie textu
                </Text>

                <Text>
                    Mama mala malú záhradu.
                </Text>

                <Text
                    style={{
                        color: "#ef4444",
                        marginTop: 10,
                    }}
                >
                    matú
                </Text>

                <Text
                    style={{
                        color: "#f97316",
                        marginTop: 6,
                    }}
                >
                    rástla
                </Text>
            </View>

            <View
                style={{
                    backgroundColor: "#3b82f6",
                    borderRadius: 24,
                    padding: 20,
                    marginTop: 20,
                    marginBottom: 40,
                }}
            >
                <Text
                    style={{
                        color: "white",
                        fontSize: 22,
                        fontWeight: "700",
                        marginBottom: 10,
                    }}
                >
                    Celkové hodnotenie
                </Text>

                <Text
                    style={{
                        color: "white",
                        opacity: 0.9,
                        marginBottom: 16,
                    }}
                >
                    Úroveň čítania: Primeraná veku
                </Text>

                <Text
                    style={{
                        color: "white",
                        lineHeight: 22,
                    }}
                >
                    Jana číta plynulo s minimálnymi
                    chybami. Odporúčame precvičiť
                    vynechávania a zhodu pri
                    časovaní slovies v rámci viet.
                </Text>

                <View
                    style={{
                        marginTop: 20,
                    }}
                >
                    <Text
                        style={{
                            color: "white",
                            marginBottom: 6,
                        }}
                    >
                        Celková presnosť
                    </Text>

                    <View
                        style={{
                            height: 8,
                            borderRadius: 4,
                            backgroundColor:
                                "rgba(255,255,255,0.3)",
                        }}
                    >
                        <View
                            style={{
                                width: "94%",
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: "white",
                            }}
                        />
                    </View>
                </View>

                <Text
                    style={{
                        color: "rgba(255,255,255,0.8)",
                        marginTop: 20,
                        fontSize: 12,
                    }}
                >
                    Demo verzia AI hodnotenia.
                </Text>
            </View>
        </ScrollView>
    );
}