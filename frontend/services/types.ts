export interface SchoolClass {
  id: number;
  name: string;
}

export interface Student {
  id: number;
  classId: number;
  firstName: string;
  lastName: string;
}

export interface AddStudentInput {
  classId: number;
  firstName: string;
  lastName: string;
}

// The class assignment stays unchanged when editing a student's name.
export interface UpdateStudentInput {
  firstName: string;
  lastName: string;
}
