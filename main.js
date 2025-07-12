// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, onSnapshot, orderBy, limit } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// --- Global Variables and DOM Elements ---
const CACHE_NAME = 'hicks-bozon404-v1'; // Ensure this matches your service-worker.js

// Firebase variables
let app;
let db;
let auth;
let userId = 'anonymous'; // Default to anonymous
let isAuthReady = false; // Flag to indicate if Firebase auth is ready

// DOM Elements
const splashScreen = document.getElementById('splash-screen');
const loadingIndicator = document.getElementById('loading-indicator');
const loadingMessage = document.getElementById('loading-message');

const homeBtn = document.getElementById('home-btn');
const historyBtn = document.getElementById('history-btn');
const homeSection = document.getElementById('home-section');
const theoryQuizSection = document.getElementById('theory-quiz-section');
const practicalQuizSection = document.getElementById('practical-quiz-section');
const historySection = document.getElementById('history-section');

const generateTheoryBtn = document.getElementById('generate-theory-btn');
const generatePracticalBtn = document.getElementById('generate-practical-btn');
const userIdDisplay = document.getElementById('user-id-display');

// Theory Quiz Elements
const theoryQuestionNumber = document.getElementById('theory-question-number');
const theoryQuestionText = document.getElementById('theory-question-text');
const theoryOptions = document.getElementById('theory-options');
const theoryFeedback = document.getElementById('theory-feedback');
const theoryHintBtn = document.getElementById('theory-hint-btn');
const theoryNextBtn = document.getElementById('theory-next-btn');

// Practical Quiz Elements
const practicalQuestionNumber = document.getElementById('practical-question-number');
const practicalQuestionText = document.getElementById('practical-question-text');
const practicalCodeInput = document.getElementById('practical-code-input');
const practicalFeedback = document.getElementById('practical-feedback');
const practicalSolution = document.getElementById('practical-solution');
const practicalSolutionCode = document.getElementById('practical-solution-code');
const practicalHintBtn = document.getElementById('practical-hint-btn');
const practicalGiveUpBtn = document.getElementById('practical-give-up-btn');
const practicalNextBtn = document.getElementById('practical-next-btn');

// History Elements
const historyList = document.getElementById('history-list');

// Custom Modal Elements
const customModal = document.getElementById('custom-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalButtons = document.getElementById('modal-buttons');

// Quiz Data
let currentQuizType = ''; // 'theory' or 'practical'
let currentQuestions = [];
let currentQuestionIndex = 0;
let theoryAttempts = 0; // Tracks attempts for current theory question
const MAX_THEORY_ATTEMPTS = 2; // Max attempts before showing correct answer

// --- Utility Functions ---

/**
 * Displays a custom modal instead of alert/confirm.
 * @param {string} title - The title of the modal.
 * @param {string} message - The message to display.
 * @param {Array<Object>} buttons - Array of button objects: [{ text: 'OK', type: 'primary', onClick: () => {} }]
 */
function showCustomModal(title, message, buttons) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalButtons.innerHTML = ''; // Clear previous buttons

    buttons.forEach(btnConfig => {
        const button = document.createElement('button');
        button.textContent = btnConfig.text;
        button.classList.add('btn');
        if (btnConfig.type === 'primary') {
            button.classList.add('btn-primary');
        } else if (btnConfig.type === 'secondary') {
            button.classList.add('btn-secondary');
        }
        button.onclick = () => {
            hideCustomModal();
            if (btnConfig.onClick) {
                btnConfig.onClick();
            }
        };
        modalButtons.appendChild(button);
    });

    customModal.classList.add('show');
}

/**
 * Hides the custom modal.
 */
function hideCustomModal() {
    customModal.classList.remove('show');
}

/**
 * Shows the loading indicator with a message.
 * @param {string} message - The message to display.
 */
function showLoading(message = 'Loading...') {
    loadingMessage.textContent = message;
    loadingIndicator.classList.add('show');
}

/**
 * Hides the loading indicator.
 */
function hideLoading() {
    loadingIndicator.classList.remove('show');
}

/**
 * Switches the active section in the UI.
 * @param {HTMLElement} sectionToShow - The section element to make active.
 */
function showSection(sectionToShow) {
    const sections = [homeSection, theoryQuizSection, practicalQuizSection, historySection];
    sections.forEach(section => {
        section.classList.remove('active');
    });
    sectionToShow.classList.add('active');
}

/**
 * Generates a unique ID (UUID v4).
 * @returns {string} A unique ID.
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Registers the service worker.
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker Registered!', registration);
            })
            .catch(error => {
                console.error('Service Worker Registration Failed:', error);
            });
    }
}

// --- Firebase Initialization and Auth ---

/**
 * Initializes Firebase and sets up authentication.
 */
async function initializeFirebase() {
    try {
        // Global variables are provided by the Canvas environment
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

        if (Object.keys(firebaseConfig).length === 0) {
            console.error("Firebase config is missing. Cannot initialize Firebase.");
            showCustomModal('Error', 'Firebase configuration is missing. Please contact support.', [{ text: 'OK', type: 'primary' }]);
            return;
        }

        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Listen for auth state changes
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                console.log("Firebase User ID:", userId);
            } else {
                // Sign in anonymously if no user is found or __initial_auth_token is not provided
                try {
                    if (typeof __initial_auth_token !== 'undefined') {
                        await signInWithCustomToken(auth, __initial_auth_token);
                        userId = auth.currentUser.uid;
                        console.log("Signed in with custom token. User ID:", userId);
                    } else {
                        await signInAnonymously(auth);
                        userId = auth.currentUser.uid;
                        console.log("Signed in anonymously. User ID:", userId);
                    }
                } catch (error) {
                    console.error("Firebase anonymous sign-in failed:", error);
                    showCustomModal('Auth Error', 'Failed to sign in. Some features may not work offline.', [{ text: 'OK', type: 'primary' }]);
                    // Fallback to a random UUID if auth completely fails (though less secure for persistence)
                    userId = crypto.randomUUID();
                }
            }
            userIdDisplay.textContent = `User ID: ${userId}`;
            isAuthReady = true;
            console.log("Firebase Auth Ready. User ID:", userId);
            // After auth is ready, load initial questions and history
            await loadInitialQuestions();
            await loadHistory();
        });

    } catch (error) {
        console.error("Error initializing Firebase:", error);
        showCustomModal('Error', 'Failed to initialize Firebase. Data persistence may not work.', [{ text: 'OK', type: 'primary' }]);
    }
}

/**
 * Saves data to Firestore.
 * @param {string} collectionName - The name of the collection.
 * @param {string} docId - The document ID.
 * @param {Object} data - The data to save.
 * @param {boolean} isPublic - True if data is public, false for private.
 */
async function saveDataToFirestore(collectionName, docId, data, isPublic = false) {
    if (!isAuthReady) {
        console.warn("Firebase not ready. Cannot save data.");
        return;
    }
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        let docRef;
        if (isPublic) {
            docRef = doc(db, `artifacts/${appId}/public/data/${collectionName}`, docId);
        } else {
            docRef = doc(db, `artifacts/${appId}/users/${userId}/${collectionName}`, docId);
        }
        await setDoc(docRef, data, { merge: true });
        console.log(`Document ${docId} saved to ${collectionName} successfully.`);
    } catch (error) {
        console.error("Error saving document to Firestore:", error);
        showCustomModal('Save Error', `Failed to save data: ${error.message}`, [{ text: 'OK', type: 'primary' }]);
    }
}

/**
 * Retrieves a document from Firestore.
 * @param {string} collectionName - The name of the collection.
 * @param {string} docId - The document ID.
 * @param {boolean} isPublic - True if data is public, false for private.
 * @returns {Object|null} The document data or null if not found.
 */
async function getDocumentFromFirestore(collectionName, docId, isPublic = false) {
    if (!isAuthReady) {
        console.warn("Firebase not ready. Cannot retrieve data.");
        return null;
    }
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        let docRef;
        if (isPublic) {
            docRef = doc(db, `artifacts/${appId}/public/data/${collectionName}`, docId);
        } else {
            docRef = doc(db, `artifacts/${appId}/users/${userId}/${collectionName}`, docId);
        }
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            console.log(`No such document: ${collectionName}/${docId}`);
            return null;
        }
    } catch (error) {
        console.error("Error getting document from Firestore:", error);
        showCustomModal('Retrieve Error', `Failed to retrieve data: ${error.message}`, [{ text: 'OK', type: 'primary' }]);
        return null;
    }
}

/**
 * Sets up a real-time listener for a collection in Firestore.
 * @param {string} collectionName - The name of the collection.
 * @param {Function} callback - The callback function to execute on data changes.
 * @param {boolean} isPublic - True if data is public, false for private.
 * @param {Array} queryConstraints - Optional array of query constraints (e.g., [where('field', '==', 'value')]).
 */
function setupFirestoreListener(collectionName, callback, isPublic = false, queryConstraints = []) {
    if (!isAuthReady) {
        console.warn("Firebase not ready. Cannot set up listener.");
        return;
    }
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    let colRef;
    if (isPublic) {
        colRef = collection(db, `artifacts/${appId}/public/data/${collectionName}`);
    } else {
        colRef = collection(db, `artifacts/${appId}/users/${userId}/${collectionName}`);
    }

    const q = query(colRef, ...queryConstraints);

    return onSnapshot(q, (snapshot) => {
        const data = [];
        snapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() });
        });
        callback(data);
    }, (error) => {
        console.error("Error listening to Firestore collection:", error);
        showCustomModal('Real-time Error', `Failed to listen for updates: ${error.message}`, [{ text: 'OK', type: 'primary' }]);
    });
}

// --- Question Data Management ---

const BUILT_IN_THEORY_QUESTIONS = [
    {
        id: 'theory-builtin-1',
        type: 'theory',
        question: 'What is the purpose of `printf()` function in C?',
        options: ['To read input from the user', 'To print output to the console', 'To declare a variable', 'To perform mathematical calculations'],
        answer: 'To print output to the console',
        explanation: 'The `printf()` function is a standard library function in C used to send formatted output to the standard output device (usually the console).',
        hint: 'Think about what "print" usually means in programming context.',
        difficulty: 'easy'
    },
    {
        id: 'theory-builtin-2',
        type: 'theory',
        question: 'Which of the following is a correct way to declare an integer variable `num` in C?',
        options: ['int num;', 'num int;', 'integer num;', 'declare num as int;'],
        answer: 'int num;',
        explanation: 'In C, variables are declared by specifying their data type followed by the variable name. `int` is the keyword for integer.',
        hint: 'Consider the basic syntax for variable declaration: `datatype variableName;`',
        difficulty: 'easy'
    },
    {
        id: 'theory-builtin-3',
        type: 'theory',
        question: 'What does `\n` represent in C programming?',
        options: ['A tab character', 'A space character', 'A newline character', 'A backspace character'],
        answer: 'A newline character',
        explanation: '`\\n` is an escape sequence used to insert a newline character, moving the cursor to the beginning of the next line.',
        hint: 'It\'s often used with `printf()` to format output across multiple lines.',
        difficulty: 'easy'
    },
    {
        id: 'theory-builtin-4',
        type: 'theory',
        question: 'What is the size of `char` data type in C?',
        options: ['1 byte', '2 bytes', '4 bytes', '8 bytes'],
        answer: '1 byte',
        explanation: 'The `char` data type is used to store single characters and typically occupies 1 byte of memory.',
        hint: 'It\'s the smallest integer type, designed to hold a single character.',
        difficulty: 'medium'
    },
    {
        id: 'theory-builtin-5',
        type: 'theory',
        question: 'Which operator is used for logical AND in C?',
        options: ['&&', '||', '!', '&'],
        answer: '&&',
        explanation: 'The `&&` operator performs a logical AND operation. It returns true if both operands are true.',
        hint: 'It\'s a double character operator.',
        difficulty: 'medium'
    },
    {
        id: 'theory-builtin-6',
        type: 'theory',
        question: 'What is the purpose of `scanf()` function?',
        options: ['To print output', 'To read input', 'To define a function', 'To allocate memory'],
        answer: 'To read input',
        explanation: 'The `scanf()` function is used to read formatted input from the standard input device (usually the keyboard).',
        hint: 'It\'s the counterpart to `printf()` for input.',
        difficulty: 'easy'
    },
    {
        id: 'theory-builtin-7',
        type: 'theory',
        question: 'What is a pointer in C?',
        options: ['A variable that stores a character', 'A variable that stores an integer', 'A variable that stores the memory address of another variable', 'A variable that stores a floating-point number'],
        answer: 'A variable that stores the memory address of another variable',
        explanation: 'A pointer is a variable whose value is the memory address of another variable, i.e., direct address of the memory location.',
        hint: 'It "points" to something in memory.',
        difficulty: 'hard'
    },
    {
        id: 'theory-builtin-8',
        type: 'theory',
        question: 'What is the entry point of a C program?',
        options: ['start()', 'begin()', 'main()', 'run()'],
        answer: 'main()',
        explanation: 'The `main()` function is the special function where the execution of every C program begins.',
        hint: 'It\'s the primary function.',
        difficulty: 'easy'
    },
    {
        id: 'theory-builtin-9',
        type: 'theory',
        question: 'Which header file is required for `malloc()` and `free()` functions?',
        options: ['stdio.h', 'stdlib.h', 'string.h', 'math.h'],
        answer: 'stdlib.h',
        explanation: 'The `malloc()` and `free()` functions, used for dynamic memory allocation, are declared in the `stdlib.h` header file.',
        hint: 'Think about standard library functions.',
        difficulty: 'medium'
    },
    {
        id: 'theory-builtin-10',
        type: 'theory',
        question: 'What is the output of `sizeof(int)`?',
        options: ['1', '2', '4', 'Depends on the system'],
        answer: 'Depends on the system',
        explanation: 'The size of `int` is implementation-defined, typically 2 or 4 bytes, depending on the compiler and system architecture.',
        hint: 'It\'s not fixed across all systems.',
        difficulty: 'hard'
    },
    {
        id: 'theory-builtin-11',
        type: 'theory',
        question: 'What is the purpose of a `for` loop?',
        options: ['To make decisions', 'To repeat a block of code a specific number of times', 'To define a function', 'To handle exceptions'],
        answer: 'To repeat a block of code a specific number of times',
        explanation: 'A `for` loop is used to iterate a block of code repeatedly as long as a condition is true, often for a fixed number of iterations.',
        hint: 'It\'s a control flow statement for iteration.',
        difficulty: 'easy'
    },
    {
        id: 'theory-builtin-12',
        type: 'theory',
        question: 'Which keyword is used to exit a loop prematurely?',
        options: ['continue', 'exit', 'break', 'return'],
        answer: 'break',
        explanation: 'The `break` statement is used to terminate the loop immediately, and control transfers to the statement immediately following the loop.',
        hint: 'It "breaks" out of the current loop.',
        difficulty: 'medium'
    },
    {
        id: 'theory-builtin-13',
        type: 'theory',
        question: 'What is the difference between `==` and `=` in C?',
        options: ['`==` is assignment, `=` is comparison', '`==` is comparison, `=` is assignment', 'Both are for comparison', 'Both are for assignment'],
        answer: '`==` is comparison, `=` is assignment',
        explanation: '`==` is the equality operator used for comparison, while `=` is the assignment operator used to assign a value to a variable.',
        hint: 'One tests for equality, the other gives a value.',
        difficulty: 'easy'
    },
    {
        id: 'theory-builtin-14',
        type: 'theory',
        question: 'What is a null pointer?',
        options: ['A pointer that points to nothing', 'A pointer that points to a string', 'A pointer that points to an integer', 'A pointer that points to the first element of an array'],
        answer: 'A pointer that points to nothing',
        explanation: 'A null pointer is a pointer that does not point to any valid memory location. It is represented by `NULL`.',
        hint: 'It\'s often used to indicate that a pointer is not currently pointing to a valid object.',
        difficulty: 'hard'
    },
    {
        id: 'theory-builtin-15',
        type: 'theory',
        question: 'Which of the following is not a valid C identifier?',
        options: ['_myVar', 'myVar123', '123myVar', 'My_Variable'],
        answer: '123myVar',
        explanation: 'Identifiers in C cannot start with a digit. They must start with a letter or an underscore.',
        hint: 'Think about the rules for naming variables.',
        difficulty: 'medium'
    },
    {
        id: 'theory-builtin-16',
        type: 'theory',
        question: 'What is the purpose of `void` keyword?',
        options: ['To indicate a function returns an integer', 'To indicate a function returns no value', 'To indicate a function takes no arguments', 'Both B and C'],
        answer: 'Both B and C',
        explanation: '`void` is used to specify that a function does not return any value, or that a function takes no parameters.',
        hint: 'It means "nothing" or "empty".',
        difficulty: 'medium'
    },
    {
        id: 'theory-builtin-17',
        type: 'theory',
        question: 'What is an array in C?',
        options: ['A collection of different data types', 'A collection of similar data types stored in contiguous memory locations', 'A single variable', 'A function'],
        answer: 'A collection of similar data types stored in contiguous memory locations',
        explanation: 'An array is a collection of data items of the same type stored at contiguous memory locations.',
        hint: 'It\'s a structured way to store multiple values of the same kind.',
        difficulty: 'easy'
    },
    {
        id: 'theory-builtin-18',
        type: 'theory',
        question: 'Which operator is used to get the address of a variable?',
        options: ['*', '&', '#', '@'],
        answer: '&',
        explanation: 'The `&` (address-of) operator is used to get the memory address of a variable.',
        hint: 'It\'s used when working with pointers.',
        difficulty: 'medium'
    },
    {
        id: 'theory-builtin-19',
        type: 'theory',
        question: 'What is the output of `5 / 2` in C (integer division)?',
        options: ['2.5', '2', '3', 'Error'],
        answer: '2',
        explanation: 'In C, when both operands of the division operator (`/`) are integers, the result is an integer (truncating any fractional part).',
        hint: 'It\'s integer division, not floating-point.',
        difficulty: 'easy'
    },
    {
        id: 'theory-builtin-20',
        type: 'theory',
        question: 'What is the purpose of `malloc()`?',
        options: ['To free dynamically allocated memory', 'To allocate memory dynamically at runtime', 'To declare a static variable', 'To copy a string'],
        answer: 'To allocate memory dynamically at runtime',
        explanation: '`malloc()` (memory allocation) is used to dynamically allocate a specified amount of memory during program execution.',
        hint: 'It\'s part of dynamic memory management.',
        difficulty: 'hard'
    }
];

const BUILT_IN_PRACTICAL_QUESTIONS = [
    {
        id: 'practical-builtin-1',
        type: 'practical',
        question: 'Write a C program to print "Hello, World!" to the console.',
        solution: `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}`,
        hint: 'You need to include the standard input/output library and use the `printf` function inside `main`.',
        difficulty: 'easy'
    },
    {
        id: 'practical-builtin-2',
        type: 'practical',
        question: 'Write a C program to add two integers and print their sum. Assume the integers are 5 and 10.',
        solution: `#include <stdio.h>\n\nint main() {\n    int a = 5;\n    int b = 10;\n    int sum = a + b;\n    printf("Sum: %d\\n", sum);\n    return 0;\n}`,
        hint: 'Declare two integer variables, assign values, add them, and print the result using `printf` with a format specifier.',
        difficulty: 'easy'
    },
    {
        id: 'practical-builtin-3',
        type: 'practical',
        question: 'Write a C program to find the largest among three numbers (e.g., 10, 25, 15) using if-else if-else.',
        solution: `#include <stdio.h>\n\nint main() {\n    int a = 10, b = 25, c = 15;\n    if (a >= b && a >= c) {\n        printf("%d is the largest.\\n", a);\n    } else if (b >= a && b >= c) {\n        printf("%d is the largest.\\n", b);\n    } else {\n        printf("%d is the largest.\\n", c);\n    }\n    return 0;\n}`,
        hint: 'Use nested `if` statements or `&&` operator to compare all three numbers.',
        difficulty: 'medium'
    },
    {
        id: 'practical-builtin-4',
        type: 'practical',
        question: 'Write a C program to calculate the factorial of a number (e.g., 5).',
        solution: `#include <stdio.h>\n\nint main() {\n    int n = 5;\n    long long factorial = 1;\n    for (int i = 1; i <= n; i++) {\n        factorial *= i;\n    }\n    printf("Factorial of %d = %lld\\n", n, factorial);\n    return 0;\n}`,
        hint: 'Use a `for` loop and multiply the numbers from 1 to `n`. Remember to use `long long` for larger factorials.',
        difficulty: 'medium'
    },
    {
        id: 'practical-builtin-5',
        type: 'practical',
        question: 'Write a C program to check if a number (e.g., 7) is prime or not.',
        solution: `#include <stdio.h>\n#include <stdbool.h>\n\nint main() {\n    int n = 7;\n    bool isPrime = true;\n    if (n <= 1) {\n        isPrime = false;\n    } else {\n        for (int i = 2; i * i <= n; i++) {\n            if (n % i == 0) {\n                isPrime = false;\n                break;\n            }\n        }\n    }\n    if (isPrime) {\n        printf("%d is a prime number.\\n", n);\n    } else {\n        printf("%d is not a prime number.\\n", n);\n    }\n    return 0;\n}`,
        hint: 'A prime number is only divisible by 1 and itself. Iterate from 2 up to the square root of the number.',
        difficulty: 'hard'
    },
    {
        id: 'practical-builtin-6',
        type: 'practical',
        question: 'Write a C program to reverse a given integer number (e.g., 12345).',
        solution: `#include <stdio.h>\n\nint main() {\n    int n = 12345;\n    int reversedNum = 0;\n    while (n != 0) {\n        int digit = n % 10;\n        reversedNum = reversedNum * 10 + digit;\n        n /= 10;\n    }\n    printf("Reversed number: %d\\n", reversedNum);\n    return 0;\n}`,
        hint: 'Use a `while` loop. Extract the last digit using modulo (`% 10`), add it to the reversed number, and remove the last digit using integer division (`/ 10`).',
        difficulty: 'medium'
    },
    {
        id: 'practical-builtin-7',
        type: 'practical',
        question: 'Write a C program to swap two numbers (e.g., a=5, b=10) without using a third variable.',
        solution: `#include <stdio.h>\n\nint main() {\n    int a = 5, b = 10;\n    printf("Before swap: a = %d, b = %d\\n", a, b);\n    a = a + b;\n    b = a - b;\n    a = a - b;\n    printf("After swap: a = %d, b = %d\\n", a, b);\n    return 0;\n}`,
        hint: 'Think about arithmetic operations (addition/subtraction or XOR) to achieve the swap.',
        difficulty: 'hard'
    },
    {
        id: 'practical-builtin-8',
        type: 'practical',
        question: 'Write a C program to check if a string is a palindrome (e.g., "madam").',
        solution: `#include <stdio.h>\n#include <string.h>\n#include <stdbool.h>\n\nint main() {\n    char str[] = "madam";\n    int length = strlen(str);\n    bool isPalindrome = true;\n    for (int i = 0; i < length / 2; i++) {\n        if (str[i] != str[length - 1 - i]) {\n            isPalindrome = false;\n            break;\n        }\n    }\n    if (isPalindrome) {\n        printf("'%s' is a palindrome.\\n", str);\n    } else {\n        printf("'%s' is not a palindrome.\\n", str);\n    }\n    return 0;\n}`,
        hint: 'Compare characters from the beginning and end of the string, moving inwards.',
        difficulty: 'hard'
    },
    {
        id: 'practical-builtin-9',
        type: 'practical',
        question: 'Write a C program to generate the Fibonacci series up to a certain number of terms (e.g., 10 terms).',
        solution: `#include <stdio.h>\n\nint main() {\n    int n = 10;\n    int t1 = 0, t2 = 1;\n    int nextTerm = t1 + t2;\n    printf("Fibonacci Series: %d, %d, ", t1, t2);\n    for (int i = 3; i <= n; ++i) {\n        printf("%d, ", nextTerm);\n        t1 = t2;\n        t2 = nextTerm;\n        nextTerm = t1 + t2;\n    }\n    printf("\\n");\n    return 0;\n}`,
        hint: 'The next term is the sum of the previous two terms. Start with 0 and 1.',
        difficulty: 'medium'
    },
    {
        id: 'practical-builtin-10',
        type: 'practical',
        question: 'Write a C program to calculate the sum of digits of a number (e.g., 123).',
        solution: `#include <stdio.h>\n\nint main() {\n    int n = 123;\n    int sum = 0;\n    while (n != 0) {\n        sum += n % 10;\n        n /= 10;\n    }\n    printf("Sum of digits: %d\\n", sum);\n    return 0;\n}`,
        hint: 'Similar to reversing a number, use modulo and division to extract and sum digits.',
        difficulty: 'easy'
    },
    {
        id: 'practical-builtin-11',
        type: 'practical',
        question: 'Write a C program to check if a number (e.g., 153) is an Armstrong number.',
        solution: `#include <stdio.h>\n#include <math.h>\n\nint main() {\n    int num = 153;\n    int originalNum, remainder, n = 0;\n    double result = 0.0;\n\n    originalNum = num;\n\n    // store the number of digits in n\n    for (originalNum = num; originalNum != 0; ++n) {\n        originalNum /= 10;\n    }\n\n    for (originalNum = num; originalNum != 0; originalNum /= 10) {\n        remainder = originalNum % 10;\n        result += pow(remainder, n);\n    }\n\n    if ((int)result == num)\n        printf("%d is an Armstrong number.\\n", num);\n    else\n        printf("%d is not an Armstrong number.\\n", num);\n\n    return 0;\n}`,
        hint: 'An Armstrong number is one whose sum of cubes of its digits is equal to the number itself (for 3-digit numbers). You\'ll need `math.h` for `pow`.',
        difficulty: 'hard'
    },
    {
        id: 'practical-builtin-12',
        type: 'practical',
        question: 'Write a C program to find the largest element in an array (e.g., {5, 12, 9, 20, 3}).',
        solution: `#include <stdio.h>\n\nint main() {\n    int arr[] = {5, 12, 9, 20, 3};\n    int n = sizeof(arr) / sizeof(arr[0]);\n    int max = arr[0];\n\n    for (int i = 1; i < n; i++) {\n        if (arr[i] > max) {\n            max = arr[i];\n        }\n    }\n\n    printf("Largest element: %d\\n", max);\n    return 0;\n}`,
        hint: 'Initialize a variable with the first element, then iterate through the rest of the array, updating if a larger element is found.',
        difficulty: 'medium'
    },
    {
        id: 'practical-builtin-13',
        type: 'practical',
        question: 'Write a C program to count the number of vowels and consonants in a string (e.g., "Programming").',
        solution: `#include <stdio.h>\n#include <string.h>\n#include <ctype.h>\n\nint main() {\n    char str[] = "Programming";\n    int vowels = 0, consonants = 0;\n\n    for (int i = 0; str[i] != '\\0'; i++) {\n        char ch = tolower(str[i]);\n        if (ch >= 'a' && ch <= 'z') {\n            if (ch == 'a' || ch == 'e' || ch == 'i' || ch == 'o' || ch == 'u') {\n                vowels++;\n            } else {\n                consonants++;\n            }\n        }\n    }\n\n    printf("Vowels: %d\\n", vowels);\n    printf("Consonants: %d\\n", consonants);\n    return 0;\n}`,
        hint: 'Iterate through the string. Convert characters to lowercase. Check if they are alphabetic, then check if they are vowels or consonants.',
        difficulty: 'hard'
    },
    {
        id: 'practical-builtin-14',
        type: 'practical',
        question: 'Write a C program to check if a given year (e.g., 2024) is a leap year.',
        solution: `#include <stdio.h>\n\nint main() {\n    int year = 2024;\n\n    if ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)) {\n        printf("%d is a leap year.\\n", year);\n    } else {\n        printf("%d is not a leap year.\\n", year);\n    }\n\n    return 0;\n}`,
        hint: 'A leap year is divisible by 4, but not by 100, unless it is also divisible by 400.',
        difficulty: 'medium'
    },
    {
        id: 'practical-builtin-15',
        type: 'practical',
        question: 'Write a C program to calculate the power of a number (e.g., 2^3).',
        solution: `#include <stdio.h>\n#include <math.h>\n\nint main() {\n    double base = 2, exp = 3;\n    double result = pow(base, exp);\n    printf("%.2lf raised to the power of %.2lf is %.2lf\\n", base, exp, result);\n    return 0;\n}`,
        hint: 'You can use a loop for integer exponents or the `pow()` function from `math.h` for floating-point exponents.',
        difficulty: 'easy'
    },
    {
        id: 'practical-builtin-16',
        type: 'practical',
        question: 'Write a C program to print the multiplication table of a number (e.g., for 7) up to 10.',
        solution: `#include <stdio.h>\n\nint main() {\n    int num = 7;\n    for (int i = 1; i <= 10; i++) {\n        printf("%d * %d = %d\\n", num, i, num * i);\n    }\n    return 0;\n}`,
        hint: 'Use a `for` loop to iterate from 1 to 10 and print the product.',
        difficulty: 'easy'
    },
    {
        id: 'practical-builtin-17',
        type: 'practical',
        question: 'Write a C program to concatenate two strings (e.g., "Hello" and "World").',
        solution: `#include <stdio.h>\n#include <string.h>\n\nint main() {\n    char str1[50] = "Hello";\n    char str2[] = "World";\n    strcat(str1, str2);\n    printf("Concatenated string: %s\\n", str1);\n    return 0;\n}`,
        hint: 'You can use the `strcat()` function from `string.h`. Make sure the destination string has enough space.',
        difficulty: 'medium'
    },
    {
        id: 'practical-builtin-18',
        type: 'practical',
        question: 'Write a C program to find the length of a string without using `strlen()` (e.g., "C Programming").',
        solution: `#include <stdio.h>\n\nint main() {\n    char str[] = "C Programming";\n    int length = 0;\n    while (str[length] != '\\0') {\n        length++;\n    }\n    printf("Length of string: %d\\n", length);\n    return 0;\n}`,
        hint: 'Iterate through the string until you encounter the null terminator (`\\0`).',
        difficulty: 'medium'
    },
    {
        id: 'practical-builtin-19',
        type: 'practical',
        question: 'Write a C program to copy one string to another (e.g., copy "Source" to "Destination").',
        solution: `#include <stdio.h>\n#include <string.h>\n\nint main() {\n    char source[] = "Source String";\n    char destination[50]; // Ensure destination has enough space\n\n    strcpy(destination, source);\n\n    printf("Source: %s\\n", source);\n    printf("Destination: %s\\n", destination);\n    return 0;\n}`,
        hint: 'You can use the `strcpy()` function from `string.h`.',
        difficulty: 'easy'
    },
    {
        id: 'practical-builtin-20',
        type: 'practical',
        question: 'Write a C program to reverse a string (e.g., "hello").',
        solution: `#include <stdio.h>\n#include <string.h>\n\nint main() {\n    char str[] = "hello";\n    int length = strlen(str);\n    for (int i = 0; i < length / 2; i++) {\n        char temp = str[i];\n        str[i] = str[length - 1 - i];\n        str[length - 1 - i] = temp;\n    }\n    printf("Reversed string: %s\\n", str);\n    return 0;\n}`,
        hint: 'Swap characters from the beginning and end of the string until you reach the middle.',
        difficulty: 'medium'
    }
];


let allQuestions = []; // Combined list of built-in and generated questions
let quizHistory = []; // Stores completed quiz sessions

/**
 * Loads initial questions from Firestore or uses built-in ones.
 */
async function loadInitialQuestions() {
    showLoading('Loading initial questions...');
    try {
        const storedQuestions = await getDocumentFromFirestore('questions', 'all_questions', false); // Private data
        if (storedQuestions && storedQuestions.data && storedQuestions.data.length > 0) {
            allQuestions = storedQuestions.data;
            console.log("Loaded questions from Firestore.");
        } else {
            allQuestions = [...BUILT_IN_THEORY_QUESTIONS, ...BUILT_IN_PRACTICAL_QUESTIONS];
            // Save built-in questions to Firestore for future use
            await saveDataToFirestore('questions', 'all_questions', { data: allQuestions }, false);
            console.log("Using built-in questions and saved to Firestore.");
        }
    } catch (error) {
        console.error("Error loading initial questions:", error);
        allQuestions = [...BUILT_IN_THEORY_QUESTIONS, ...BUILT_IN_PRACTICAL_QUESTIONS];
        showCustomModal('Error', 'Failed to load questions from storage. Using built-in questions.', [{ text: 'OK', type: 'primary' }]);
    } finally {
        hideLoading();
    }
}

/**
 * Loads quiz history from Firestore.
 */
async function loadHistory() {
    if (!isAuthReady) {
        console.warn("Firebase not ready. Cannot load history.");
        return;
    }
    // Use onSnapshot to listen for real-time updates to history
    setupFirestoreListener('history', (data) => {
        quizHistory = data.sort((a, b) => b.timestamp - a.timestamp); // Sort by most recent
        renderHistory();
        console.log("History updated:", quizHistory);
    }, false, [orderBy('timestamp', 'desc'), limit(50)]); // Order by timestamp, limit to 50 entries
}

/**
 * Saves a completed quiz session to history.
 * @param {Object} quizSession - The quiz session object.
 */
async function saveQuizSession(quizSession) {
    if (!isAuthReady) {
        console.warn("Firebase not ready. Cannot save quiz session.");
        return;
    }
    const historyId = generateUUID();
    const sessionData = {
        ...quizSession,
        timestamp: Date.now(), // Add a timestamp for sorting
        userId: userId // Store userId for potential future multi-user features
    };
    await saveDataToFirestore('history', historyId, sessionData, false);
}

// --- Question Generation (Gemini API) ---

/**
 * Calls the Gemini API to generate new questions.
 * @param {string} type - 'theory' or 'practical'.
 * @param {number} count - Number of questions to generate.
 * @returns {Array<Object>} An array of generated questions.
 */
async function generateQuestions(type, count) {
    showLoading(`Generating ${count} ${type} questions...`);
    try {
        let prompt;
        let responseSchema;

        if (type === 'theory') {
            prompt = `Generate ${count} unique C programming theory multiple-choice questions. Each question should have a question text, 4 options (one correct), the correct answer, a brief explanation, and a hint. Ensure the questions cover a range of difficulty levels (easy, medium, hard). Provide the output as a JSON array of objects. Example structure for one question:
            {
                "id": "unique_id_theory_X",
                "type": "theory",
                "question": "Your question text?",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "answer": "Correct Option",
                "explanation": "Brief explanation.",
                "hint": "A helpful hint.",
                "difficulty": "easy/medium/hard"
            }`;
            responseSchema = {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        "id": { "type": "STRING" },
                        "type": { "type": "STRING", "enum": ["theory"] },
                        "question": { "type": "STRING" },
                        "options": { "type": "ARRAY", "items": { "type": "STRING" } },
                        "answer": { "type": "STRING" },
                        "explanation": { "type": "STRING" },
                        "hint": { "type": "STRING" },
                        "difficulty": { "type": "STRING", "enum": ["easy", "medium", "hard"] }
                    },
                    "required": ["id", "type", "question", "options", "answer", "explanation", "hint", "difficulty"]
                }
            };
        } else if (type === 'practical') {
            prompt = `Generate ${count} unique C programming practical coding questions. Each question should have a question text, a correct C code solution, a brief hint, and a difficulty level (easy, medium, hard). Provide the output as a JSON array of objects. Example structure for one question:
            {
                "id": "unique_id_practical_Y",
                "type": "practical",
                "question": "Write a C program to...",
                "solution": "#include <stdio.h>\\n\\nint main() {\\n    // Your code here\\n    return 0;\\n}",
                "hint": "A helpful hint for coding.",
                "difficulty": "easy/medium/hard"
            }`;
            responseSchema = {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        "id": { "type": "STRING" },
                        "type": { "type": "STRING", "enum": ["practical"] },
                        "question": { "type": "STRING" },
                        "solution": { "type": "STRING" },
                        "hint": { "type": "STRING" },
                        "difficulty": { "type": "STRING", "enum": ["easy", "medium", "hard"] }
                    },
                    "required": ["id", "type", "question", "solution", "hint", "difficulty"]
                }
            };
        } else {
            throw new Error("Invalid question type specified.");
        }

        let chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });

        const payload = {
            contents: chatHistory,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        };

        const apiKey = ""; // Canvas will provide this
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API error response:", errorData);
            throw new Error(`API call failed with status: ${response.status} - ${errorData.error.message || response.statusText}`);
        }

        const result = await response.json();

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const jsonString = result.candidates[0].content.parts[0].text;
            const generated = JSON.parse(jsonString);

            // Add unique IDs to generated questions if not already present
            const finalQuestions = generated.map(q => ({
                ...q,
                id: q.id || `${type}-generated-${generateUUID()}`
            }));

            // Cache new questions using Service Worker message (for potential future use)
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'CACHE_NEW_QUESTIONS',
                    questions: finalQuestions.map(q => ({ id: q.id, type: q.type })) // Send only metadata
                });
            }

            return finalQuestions;
        } else {
            console.error("Unexpected Gemini API response structure:", result);
            throw new Error("Failed to parse generated questions. Unexpected API response.");
        }
    } catch (error) {
        console.error("Error generating questions:", error);
        showCustomModal('Generation Error', `Failed to generate questions: ${error.message}. Please try again.`, [{ text: 'OK', type: 'primary' }]);
        return [];
    } finally {
        hideLoading();
    }
}

// --- Quiz Logic ---

/**
 * Starts a new quiz session.
 * @param {string} type - 'theory' or 'practical'.
 * @param {Array<Object>} questions - Array of questions for the quiz.
 */
function startQuiz(type, questions) {
    currentQuizType = type;
    currentQuestions = questions;
    currentQuestionIndex = 0;
    theoryAttempts = 0; // Reset attempts for theory quiz

    if (type === 'theory') {
        showSection(theoryQuizSection);
        displayTheoryQuestion();
    } else if (type === 'practical') {
        showSection(practicalQuizSection);
        displayPracticalQuestion();
    }
}

/**
 * Displays the current theory question.
 */
function displayTheoryQuestion() {
    if (currentQuestionIndex >= currentQuestions.length) {
        endQuiz();
        return;
    }

    const question = currentQuestions[currentQuestionIndex];
    theoryQuestionNumber.textContent = `Question ${currentQuestionIndex + 1}/${currentQuestions.length}`;
    theoryQuestionText.textContent = question.question;
    theoryOptions.innerHTML = ''; // Clear previous options
    theoryFeedback.textContent = '';
    theoryNextBtn.style.display = 'none';
    theoryHintBtn.style.display = 'inline-block'; // Show hint button
    theoryAttempts = 0; // Reset attempts for this question

    // Shuffle options to prevent answer memorization by position
    const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);

    shuffledOptions.forEach(option => {
        const button = document.createElement('button');
        button.classList.add('btn', 'btn-outline', 'w-full', 'text-left');
        button.textContent = option;
        button.onclick = () => checkTheoryAnswer(option, question.answer, question.explanation);
        theoryOptions.appendChild(button);
    });
}

/**
 * Checks the user's answer for a theory question.
 * @param {string} selectedOption - The option selected by the user.
 * @param {string} correctAnswer - The correct answer.
 * @param {string} explanation - The explanation for the answer.
 */
function checkTheoryAnswer(selectedOption, correctAnswer, explanation) {
    const optionButtons = theoryOptions.querySelectorAll('button');
    optionButtons.forEach(button => button.disabled = true); // Disable options after selection

    if (selectedOption === correctAnswer) {
        theoryFeedback.textContent = `Correct! ${explanation}`;
        theoryFeedback.classList.remove('text-red-600');
        theoryFeedback.classList.add('text-green-600');
        markQuestionAsCovered(currentQuestions[currentQuestionIndex], 'theory', true);
        theoryNextBtn.style.display = 'inline-block';
        theoryHintBtn.style.display = 'none'; // Hide hint once answered correctly
    } else {
        theoryAttempts++;
        if (theoryAttempts < MAX_THEORY_ATTEMPTS) {
            theoryFeedback.textContent = `Incorrect. Try again.`;
            theoryFeedback.classList.remove('text-green-600');
            theoryFeedback.classList.add('text-red-600');
            optionButtons.forEach(button => button.disabled = false); // Re-enable options
            // Optionally, highlight incorrect choice and remove it
            Array.from(optionButtons).find(btn => btn.textContent === selectedOption).classList.add('bg-red-200');
        } else {
            theoryFeedback.textContent = `Incorrect. The correct answer was: "${correctAnswer}". ${explanation}`;
            theoryFeedback.classList.remove('text-green-600');
            theoryFeedback.classList.add('text-red-600');
            markQuestionAsCovered(currentQuestions[currentQuestionIndex], 'theory', false);
            theoryNextBtn.style.display = 'inline-block';
            theoryHintBtn.style.display = 'none'; // Hide hint
            // Highlight correct answer
            Array.from(optionButtons).find(btn => btn.textContent === correctAnswer).classList.add('bg-green-200');
        }
    }
}

/**
 * Provides a hint for the current theory question.
 */
function provideTheoryHint() {
    const question = currentQuestions[currentQuestionIndex];
    showCustomModal('Hint', question.hint, [{ text: 'Got it!', type: 'primary' }]);
}

/**
 * Displays the current practical question.
 */
function displayPracticalQuestion() {
    if (currentQuestionIndex >= currentQuestions.length) {
        endQuiz();
        return;
    }

    const question = currentQuestions[currentQuestionIndex];
    practicalQuestionNumber.textContent = `Question ${currentQuestionIndex + 1}/${currentQuestions.length}`;
    practicalQuestionText.textContent = question.question;
    practicalCodeInput.value = ''; // Clear previous input
    practicalFeedback.textContent = '';
    practicalSolution.classList.add('hidden'); // Hide solution
    practicalSolutionCode.textContent = ''; // Clear solution code
    practicalNextBtn.style.display = 'none';
    practicalHintBtn.style.display = 'inline-block';
    practicalGiveUpBtn.style.display = 'inline-block';
}

/**
 * Provides a hint for the current practical question.
 */
function providePracticalHint() {
    const question = currentQuestions[currentQuestionIndex];
    showCustomModal('Hint', question.hint, [{ text: 'Got it!', type: 'primary' }]);
}

/**
 * Reveals the solution for the current practical question.
 */
function revealPracticalSolution() {
    const question = currentQuestions[currentQuestionIndex];
    practicalSolutionCode.textContent = question.solution;
    practicalSolution.classList.remove('hidden');
    practicalFeedback.textContent = 'Here is the correct solution.';
    practicalFeedback.classList.remove('text-green-600');
    practicalFeedback.classList.add('text-blue-600');
    practicalNextBtn.style.display = 'inline-block';
    practicalHintBtn.style.display = 'none';
    practicalGiveUpBtn.style.display = 'none';
    markQuestionAsCovered(currentQuestions[currentQuestionIndex], 'practical', false); // Mark as incorrect if user gave up
}

/**
 * Moves to the next question in the current quiz.
 */
function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuizType === 'theory') {
        displayTheoryQuestion();
    } else if (currentQuizType === 'practical') {
        displayPracticalQuestion();
    }
}

/**
 * Ends the current quiz session.
 */
function endQuiz() {
    showCustomModal(
        'Quiz Completed!',
        `You have completed the ${currentQuizType} quiz. Well done!`,
        [{ text: 'Go Home', type: 'primary', onClick: () => showSection(homeSection) }]
    );
    // Save the quiz session to history (this is handled by markQuestionAsCovered for each question)
}

/**
 * Marks a question as covered in history.
 * @param {Object} question - The question object.
 * @param {string} type - 'theory' or 'practical'.
 * @param {boolean} isCorrect - Whether the user answered correctly.
 */
async function markQuestionAsCovered(question, type, isCorrect) {
    const historyEntry = {
        questionId: question.id,
        questionText: question.question,
        type: type,
        answeredCorrectly: isCorrect,
        timestamp: Date.now()
    };
    // Save each question's outcome individually to history
    await saveQuizSession(historyEntry);
}

// --- History Section ---

/**
 * Renders the quiz history in the UI.
 */
function renderHistory() {
    historyList.innerHTML = ''; // Clear previous history

    if (quizHistory.length === 0) {
        historyList.innerHTML = '<p class="text-gray-500">No history yet. Start a quiz!</p>';
        return;
    }

    quizHistory.forEach(entry => {
        const historyItem = document.createElement('div');
        historyItem.classList.add('card', 'p-4', 'mb-3', 'flex', 'flex-col', 'space-y-2');
        historyItem.innerHTML = `
            <p class="text-md font-semibold">${entry.questionText}</p>
            <p class="text-sm text-gray-600">Type: <span class="font-medium">${entry.type === 'theory' ? 'Theory' : 'Practical'}</span></p>
            <p class="text-sm ${entry.answeredCorrectly ? 'text-green-600' : 'text-red-600'}">
                Status: <span class="font-bold">${entry.answeredCorrectly ? 'Correct' : 'Incorrect'}</span>
            </p>
            <p class="text-xs text-gray-400">Date: ${new Date(entry.timestamp).toLocaleString()}</p>
        `;
        historyList.appendChild(historyItem);
    });
}

// --- Event Listeners ---

// Splash screen fading
window.addEventListener('load', () => {
    setTimeout(() => {
        splashScreen.classList.add('hidden');
        // Optional: Remove splash screen from DOM after transition
        splashScreen.addEventListener('transitionend', () => {
            splashScreen.remove();
        });
    }, 3000); // 3 seconds
});

// Navigation buttons
homeBtn.addEventListener('click', () => showSection(homeSection));
historyBtn.addEventListener('click', () => showSection(historySection));

// Generate Questions buttons
generateTheoryBtn.addEventListener('click', async () => {
    const generated = await generateQuestions('theory', 20);
    if (generated.length > 0) {
        // Combine built-in and new questions, ensuring uniqueness by ID
        const newTheoryQuestions = [...BUILT_IN_THEORY_QUESTIONS, ...generated].filter((q, i, a) => a.findIndex(t => t.id === q.id) === i);
        // Save the updated list of all questions (including new ones)
        allQuestions = [...allQuestions.filter(q => q.type !== 'theory'), ...newTheoryQuestions];
        await saveDataToFirestore('questions', 'all_questions', { data: allQuestions }, false);

        showCustomModal(
            'Questions Generated!',
            '20 new theory questions are ready. Starting quiz now!',
            [{ text: 'OK', type: 'primary', onClick: () => startQuiz('theory', newTheoryQuestions) }]
        );
    }
});

generatePracticalBtn.addEventListener('click', async () => {
    const generated = await generateQuestions('practical', 20);
    if (generated.length > 0) {
        // Combine built-in and new questions, ensuring uniqueness by ID
        const newPracticalQuestions = [...BUILT_IN_PRACTICAL_QUESTIONS, ...generated].filter((q, i, a) => a.findIndex(t => t.id === q.id) === i);
        // Save the updated list of all questions (including new ones)
        allQuestions = [...allQuestions.filter(q => q.type !== 'practical'), ...newPracticalQuestions];
        await saveDataToFirestore('questions', 'all_questions', { data: allQuestions }, false);

        showCustomModal(
            'Questions Generated!',
            '20 new practical questions are ready. Starting quiz now!',
            [{ text: 'OK', type: 'primary', onClick: () => startQuiz('practical', newPracticalQuestions) }]
        );
    }
});

// Theory Quiz buttons
theoryHintBtn.addEventListener('click', provideTheoryHint);
theoryNextBtn.addEventListener('click', nextQuestion);

// Practical Quiz buttons
practicalHintBtn.addEventListener('click', providePracticalHint);
practicalGiveUpBtn.addEventListener('click', () => {
    showCustomModal(
        'Give Up?',
        'Are you sure you want to give up on this question? The solution will be revealed.',
        [
            { text: 'Cancel', type: 'secondary' },
            { text: 'Yes, Give Up', type: 'primary', onClick: revealPracticalSolution }
        ]
    );
});
practicalNextBtn.addEventListener('click', nextQuestion);

// --- Initialization Calls ---
document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker(); // Register PWA Service Worker
    initializeFirebase(); // Initialize Firebase and handle auth
});

