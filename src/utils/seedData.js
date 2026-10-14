// Demonstration data shown the first time Scheduly opens.
// All of it is flagged origin: 'demo' — these are sample schedules, not generated or validated ones.

import {
  makeActivities,
  makeTimetable,
  slotsFromMatrix,
  uid,
} from './timetableModel.js'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export const SEED_TEACHERS = [
  { id: 't-rao', name: 'Dr. S. Rao', subjects: 'Data Structures', availability: 'Mon–Fri, 9:00–16:00' },
  { id: 't-iyer', name: 'Prof. M. Iyer', subjects: 'Database Systems', availability: 'Mon–Thu' },
  { id: 't-khan', name: 'Ms. A. Khan', subjects: 'Operating Systems, Computer Networks', availability: 'Mon–Fri' },
  { id: 't-verma', name: 'Mr. P. Verma', subjects: 'Engineering Mathematics', availability: 'Mon–Fri, mornings' },
  { id: 't-menon', name: 'Mrs. R. Menon', subjects: 'Mathematics (school)', availability: 'Mon–Sat, mornings' },
  { id: 't-george', name: 'Mr. T. George', subjects: 'Computer Science (school)', availability: 'Mon–Sat' },
  { id: 't-nair', name: 'Mrs. L. Nair', subjects: 'English, Hindi', availability: 'Mon–Sat' },
  { id: 't-das', name: 'Mr. K. Das', subjects: 'Science, Physical Education', availability: 'Mon–Sat' },
]

export const SEED_ROOMS = [
  { id: 'r-lh1', name: 'Lecture Hall 1', type: 'Classroom', capacity: 90 },
  { id: 'r-lab2', name: 'Computer Lab 2', type: 'Lab', capacity: 40 },
  { id: 'r-lab1', name: 'Computer Lab 1', type: 'Lab', capacity: 40 },
  { id: 'r-10a', name: 'Room 10-A', type: 'Classroom', capacity: 40 },
  { id: 'r-sci', name: 'Science Lab', type: 'Lab', capacity: 35 },
  { id: 'r-gym', name: 'Playground', type: 'Outdoor', capacity: 120 },
]

export const SEED_SUBJECTS = [
  { id: 's-ds', name: 'Data Structures', category: 'Core', color: '#2563EB' },
  { id: 's-db', name: 'Database Systems', category: 'Core', color: '#0D9488' },
  { id: 's-math', name: 'Mathematics', category: 'Core', color: '#D97706' },
  { id: 's-sci', name: 'Science', category: 'Core', color: '#16A34A' },
  { id: 's-eng', name: 'English', category: 'Language', color: '#7C3AED' },
  { id: 's-study', name: 'Study', category: 'Personal', color: '#4F46E5' },
  { id: 's-ex', name: 'Exercise', category: 'Personal', color: '#EA580C' },
]

export const SEED_CONSTRAINTS = [
  { id: 'c-teacher', rule: 'teacher_clash', label: 'A teacher cannot be in two classes at the same time', enabled: true },
  { id: 'c-room', rule: 'room_clash', label: 'A room cannot host two classes at the same time', enabled: true },
  { id: 'c-class', rule: 'class_overlap', label: 'A class cannot have overlapping subjects', enabled: true },
  { id: 'c-personal', rule: 'personal_overlap', label: 'Personal activities cannot overlap unless explicitly allowed', enabled: true },
  { id: 'c-break', rule: 'unavailable', label: 'Nothing is scheduled during breaks or unavailable times', enabled: true },
]

export function buildSeedTimetables(now = Date.now()) {
  // 1. College schedule
  let college = makeTimetable(
    {
      name: 'College Schedule',
      type: 'college',
      category: 'CSE · Semester 5',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      startTime: '09:00',
      endTime: '16:00',
      slotMinutes: 60,
      breaks: [{ label: 'Lunch', start: '12:00', end: '13:00' }],
      activityNames: [
        'Data Structures',
        'Database Systems',
        'Operating Systems',
        'Computer Networks',
        'Engineering Mathematics',
        'Lab Session',
      ],
      trackResources: true,
      status: 'Active',
      origin: 'demo',
      createdAt: now - 20 * DAY,
      updatedAt: now - 2 * HOUR,
    },
    now,
  )
  college = {
    ...college,
    slots: slotsFromMatrix(
      college,
      [
        ['Data Structures', 'Database Systems', 'Operating Systems', 'Computer Networks', 'Lab Session', 'Lab Session'],
        ['Engineering Mathematics', 'Data Structures', 'Database Systems', 'Operating Systems', 'Computer Networks'],
        ['Computer Networks', 'Engineering Mathematics', 'Data Structures', 'Lab Session', 'Lab Session'],
        ['Database Systems', 'Operating Systems', 'Computer Networks', 'Engineering Mathematics', 'Data Structures'],
        ['Engineering Mathematics', 'Computer Networks', 'Database Systems', 'Operating Systems'],
      ],
      {
        'Data Structures': ['t-rao', 'r-lh1'],
        'Database Systems': ['t-iyer', 'r-lh1'],
        'Operating Systems': ['t-khan', 'r-lh1'],
        'Computer Networks': ['t-khan', 'r-lh1'],
        'Engineering Mathematics': ['t-verma', 'r-lh1'],
        'Lab Session': ['t-rao', 'r-lab2'],
      },
    ),
  }

  // 2. Class 10-A
  let school = makeTimetable(
    {
      name: 'Class 10-A',
      type: 'school',
      category: 'Class 10 · Section A',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      startTime: '08:30',
      endTime: '14:00',
      slotMinutes: 45,
      breaks: [
        { label: 'Short break', start: '10:00', end: '10:15' },
        { label: 'Lunch', start: '11:45', end: '12:30' },
      ],
      activityNames: [
        'Mathematics',
        'Science',
        'English',
        'Social Studies',
        'Hindi',
        'Computer Science',
        'Physical Education',
      ],
      trackResources: true,
      status: 'Active',
      origin: 'demo',
      createdAt: now - 45 * DAY,
      updatedAt: now - 1 * DAY - 3 * HOUR,
    },
    now,
  )
  school = {
    ...school,
    slots: slotsFromMatrix(
      school,
      [
        ['Mathematics', 'English', 'Science', 'Hindi', 'Social Studies', 'Computer Science'],
        ['Science', 'Mathematics', 'English', 'Social Studies', 'Hindi', 'Physical Education'],
        ['English', 'Hindi', 'Mathematics', 'Science', 'Computer Science', 'Social Studies'],
        ['Mathematics', 'Social Studies', 'Physical Education', 'English', 'Science', 'Hindi'],
        ['Hindi', 'Science', 'Mathematics', 'Computer Science', 'English', 'Social Studies'],
        ['Mathematics', 'Computer Science', 'English', 'Science'],
      ],
      {
        Mathematics: ['t-menon', 'r-10a'],
        Science: ['t-das', 'r-sci'],
        English: ['t-nair', 'r-10a'],
        Hindi: ['t-nair', 'r-10a'],
        'Social Studies': ['t-nair', 'r-10a'],
        'Computer Science': ['t-george', 'r-lab1'],
        'Physical Education': ['t-das', 'r-gym'],
      },
    ),
  }

  // 3. Daily routine
  let routine = makeTimetable(
    {
      name: 'Daily Routine',
      type: 'personal',
      category: 'Personal',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      startTime: '06:00',
      endTime: '22:00',
      slotMinutes: 60,
      breaks: [{ label: 'Lunch', start: '13:00', end: '14:00' }],
      activityNames: ['Morning routine', 'Exercise', 'Study', 'Work', 'Hobby', 'Family time', 'Wind down'],
      trackResources: false,
      status: 'Active',
      origin: 'demo',
      createdAt: now - 12 * DAY,
      updatedAt: now - 3 * DAY,
    },
    now,
  )
  const weekday = [
    'Exercise', 'Morning routine', 'Study', 'Study', 'Study', 'Study', 'Hobby',
    'Study', 'Study', 'Hobby', 'Exercise', 'Family time', 'Family time', 'Hobby', 'Wind down',
  ]
  const weekend = [
    'Morning routine', 'Exercise', 'Hobby', 'Hobby', 'Family time', null, null,
    'Family time', null, 'Hobby', 'Study', 'Family time', 'Family time', 'Hobby', 'Wind down',
  ]
  routine = {
    ...routine,
    slots: slotsFromMatrix(routine, [weekday, weekday, weekday, weekday, weekday, weekend, weekend]),
  }

  // 4. Exam preparation
  let exam = makeTimetable(
    {
      name: 'Exam Preparation',
      type: 'study',
      category: 'Semester exams',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      startTime: '08:00',
      endTime: '19:30',
      slotMinutes: 90,
      breaks: [{ label: 'Lunch', start: '12:30', end: '13:30' }],
      activityNames: ['Mathematics', 'Physics', 'Chemistry', 'Mock test', 'Weak topics', 'Light recap'],
      trackResources: false,
      status: 'Draft',
      origin: 'demo',
      createdAt: now - 6 * DAY,
      updatedAt: now - 5 * HOUR,
    },
    now,
  )
  exam = {
    ...exam,
    slots: slotsFromMatrix(exam, [
      ['Mathematics', 'Physics', 'Chemistry', 'Mathematics', 'Physics', 'Weak topics', 'Light recap'],
      ['Chemistry', 'Mathematics', 'Physics', 'Chemistry', 'Mathematics', 'Weak topics', 'Light recap'],
      ['Physics', 'Chemistry', 'Mathematics', 'Physics', 'Chemistry', 'Mock test', 'Mock test'],
      ['Mathematics', 'Physics', 'Chemistry', 'Weak topics', 'Mathematics', 'Physics', 'Light recap'],
      ['Chemistry', 'Mathematics', 'Physics', 'Chemistry', 'Weak topics', 'Mathematics', 'Light recap'],
      ['Mock test', 'Mock test', 'Weak topics', 'Mock test', 'Mock test', 'Light recap'],
    ]),
  }

  return [college, school, routine, exam]
}

export function buildSeedResources() {
  return {
    subjects: SEED_SUBJECTS.map((s) => ({ ...s })),
    teachers: SEED_TEACHERS.map((t) => ({ ...t })),
    rooms: SEED_ROOMS.map((r) => ({ ...r })),
  }
}

export function buildSeedConstraints() {
  return SEED_CONSTRAINTS.map((c) => ({ ...c }))
}

// Re-exported so callers that only need ids/activities do not import the model separately.
export { uid, makeActivities }
