// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, onSnapshot, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// --- Global App State and Firebase Variables ---
const app = {}; // Global object to hold app-wide variables and functions

let firebaseApp;
let db;
let auth;
let userId = 'anonymous'; // Default to anonymous, will be updated by auth state
let isAuthReady = false; // Flag to indicate if Firebase auth is ready

// Get environment variables for Firebase
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- App Data Structures ---
app.questions = {
    theory: [],
    practical: []
};
app.currentQuiz = {
    type: null, // 'theory' or 'practical'
    questions: [],
    currentIndex: 0,
    userAnswers: {}, // Stores user's answers for the current quiz session
    attempts: {} // Tracks attempts for theory questions
};
app.history = []; // Stores user's quiz history

// --- DOM Elements ---
const splashScreen = document.getElementById('splash-screen');
const appContainer = document.getElementById('app-container');
const mainContent = document.getElementById('main-content');
const customModal = document.getElementById('custom-modal');
const modalMessage = document.getElementById('modal-message');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalOkBtn = document.getElementById('modal-ok-btn');

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });
}

// --- Firebase Initialization and Authentication ---
const initFirebase = async () => {
    try {
        firebaseApp = initializeApp(firebaseConfig);
        db = getFirestore(firebaseApp);
        auth = getAuth(firebaseApp);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                console.log('User signed in:', userId);
            } else {
                // If no user, sign in anonymously if no custom token provided
                if (!initialAuthToken) {
                    await signInAnonymously(auth);
                    console.log('Signed in anonymously.');
                }
            }
            isAuthReady = true; // Auth state is now known
            console.log("Firebase Auth Ready. User ID:", userId);
            // After auth is ready, load history and initial questions
            await app.loadHistory();
            app.renderHomeScreen(); // Render home screen after everything is loaded
            appContainer.style.display = 'flex'; // Show app container
        });

        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log('Signed in with custom token.');
        } else {
            // If initialAuthToken is not defined, onAuthStateChanged will handle anonymous sign-in
            console.log('No initial auth token, waiting for onAuthStateChanged to handle sign-in.');
        }

    } catch (error) {
        console.error('Error initializing Firebase:', error);
        app.showModal(`Error initializing app: ${error.message}`, 'OK');
        appContainer.style.display = 'flex'; // Show app container even on error
        app.renderHomeScreen();
    }
};

// --- Splash Screen Logic ---
window.onload = () => {
    // Ensure the splash screen is visible initially
    splashScreen.style.opacity = '1';
    splashScreen.style.pointerEvents = 'auto';

    setTimeout(() => {
        splashScreen.classList.add('hidden'); // Fade out splash screen
        setTimeout(() => {
            splashScreen.style.display = 'none'; // Remove from flow after transition
        }, 500); // Match transition duration
        initFirebase(); // Initialize Firebase after splash screen
    }, 3000); // 3 seconds splash screen
};

// --- Custom Modal Functions (replaces alert/confirm) ---
app.showModal = (message, type, onConfirm = null, onCancel = null) => {
    modalMessage.textContent = message;
    modalConfirmBtn.classList.add('hidden');
    modalCancelBtn.classList.add('hidden');
    modalOkBtn.classList.add('hidden');

    if (type === 'OK') {
        modalOkBtn.classList.remove('hidden');
        modalOkBtn.onclick = () => {
            app.closeModal();
            if (onConfirm) onConfirm();
        };
    } else if (type === 'CONFIRM') {
        modalConfirmBtn.classList.remove('hidden');
        modalCancelBtn.classList.remove('hidden');
        modalConfirmBtn.onclick = () => {
            app.closeModal();
            if (onConfirm) onConfirm();
        };
        modalCancelBtn.onclick = () => {
            app.closeModal();
            if (onCancel) onCancel();
        };
    }

    customModal.classList.add('active');
};

app.closeModal = () => {
    customModal.classList.remove('active');
};

// --- Hardcoded Initial Questions ---
// These questions will be available immediately and cached by the service worker.
app.initialQuestions = {
    theory: [
        {
            id: 'T001',
            question: 'What is the primary purpose of the `main` function in a C program?',
            options: [
                'To declare global variables',
                'To define custom data types',
                'The entry point of program execution',
                'To include header files'
            ],
            correctAnswer: 'The entry point of program execution',
            explanation: 'The `main` function is where the program execution begins. Every C program must have a `main` function.',
            hint: 'Think about where a C program always starts running.'
        },
        {
            id: 'T002',
            question: 'Which of the following is NOT a valid C data type?',
            options: [
                'int',
                'float',
                'boolean',
                'char'
            ],
            correctAnswer: 'boolean',
            explanation: 'C does not have a built-in `boolean` data type. Booleans are typically represented using `int` (0 for false, non-zero for true).',
            hint: 'Consider how truth values are usually represented in C.'
        },
        {
            id: 'T003',
            question: 'What does `printf()` function do in C?',
            options: [
                'Reads input from the user',
                'Allocates memory dynamically',
                'Prints formatted output to the console',
                'Performs mathematical calculations'
            ],
            correctAnswer: 'Prints formatted output to the console',
            explanation: '`printf()` is a standard library function used to print formatted output to the standard output stream (usually the console).',
            hint: 'Its name suggests its primary action.'
        },
        {
            id: 'T004',
            question: 'Which header file is necessary for using `printf()` and `scanf()`?',
            options: [
                'stdio.h',
                'stdlib.h',
                'string.h',
                'math.h'
            ],
            correctAnswer: 'stdio.h',
            explanation: '`stdio.h` (Standard Input/Output Header) contains declarations for input/output functions like `printf()` and `scanf()`.',
            hint: 'Think about standard input and output operations.'
        },
        {
            id: 'T005',
            question: 'What is the purpose of the `scanf()` function?',
            options: [
                'To print output to a file',
                'To read formatted input from the console',
                'To write data to a database',
                'To concatenate strings'
            ],
            correctAnswer: 'To read formatted input from the console',
            explanation: '`scanf()` is used to read formatted input from the standard input stream (usually the keyboard).',
            hint: 'It\'s the counterpart to `printf()` for input.'
        },
        {
            id: 'T006',
            question: 'What is a pointer in C?',
            options: [
                'A variable that stores a character',
                'A variable that stores the memory address of another variable',
                'A function that returns an integer',
                'A type of loop control structure'
            ],
            correctAnswer: 'A variable that stores the memory address of another variable',
            explanation: 'A pointer is a powerful feature in C that allows direct memory manipulation by storing the memory address of another variable.',
            hint: 'It "points" to something in memory.'
        },
        {
            id: 'T007',
            question: 'Which operator is used to get the address of a variable?',
            options: [
                '* (dereference operator)',
                '& (address-of operator)',
                '-> (arrow operator)',
                '. (dot operator)'
            ],
            correctAnswer: '& (address-of operator)',
            explanation: 'The `&` operator, also known as the address-of operator, returns the memory address of its operand.',
            hint: 'It looks like an ampersand.'
        },
        {
            id: 'T008',
            question: 'Which operator is used to dereference a pointer (access the value at the address it points to)?',
            options: [
                '& (address-of operator)',
                '* (dereference operator)',
                '++ (increment operator)',
                '== (equality operator)'
            ],
            correctAnswer: '* (dereference operator)',
            explanation: 'The `*` operator, when used with a pointer, dereferences it, meaning it accesses the value stored at the memory address the pointer holds.',
            hint: 'It\'s the same symbol used to declare a pointer.'
        },
        {
            id: 'T009',
            question: 'What is the correct way to declare an integer pointer `ptr`?',
            options: [
                'int ptr;',
                'int *ptr;',
                'pointer int ptr;',
                'int &ptr;'
            ],
            correctAnswer: 'int *ptr;',
            explanation: 'To declare a pointer, the asterisk `*` is used before the pointer variable name, indicating that it will store an address of a variable of the specified type.',
            hint: 'The asterisk signifies a pointer declaration.'
        },
        {
            id: 'T010',
            question: 'What is the purpose of the `for` loop in C?',
            options: [
                'To make decisions based on conditions',
                'To execute a block of code repeatedly a fixed number of times',
                'To define a new function',
                'To handle exceptions'
            ],
            correctAnswer: 'To execute a block of code repeatedly a fixed number of times',
            explanation: 'The `for` loop is a control flow statement that allows code to be executed repeatedly based on a counter or a condition, typically when the number of iterations is known.',
            hint: 'It\'s used for iteration when you know how many times you want to repeat.'
        },
        {
            id: 'T011',
            question: 'What is the difference between `while` and `do-while` loops?',
            options: [
                '`while` always executes at least once, `do-while` may not.',
                '`do-while` always executes at least once, `while` may not.',
                'There is no difference, they are interchangeable.',
                '`while` is for fixed iterations, `do-while` is for indefinite iterations.'
            ],
            correctAnswer: '`do-while` always executes at least once, `while` may not.',
            explanation: 'The `do-while` loop checks its condition after executing the loop body, guaranteeing at least one execution. The `while` loop checks its condition before, so it might not execute at all.',
            hint: 'Consider when the condition is checked for each loop type.'
        },
        {
            id: 'T012',
            question: 'What is an array in C?',
            options: [
                'A collection of different data types',
                'A collection of variables of the same data type stored at contiguous memory locations',
                'A user-defined data type',
                'A function that returns multiple values'
            ],
            correctAnswer: 'A collection of variables of the same data type stored at contiguous memory locations',
            explanation: 'An array is a fixed-size sequential collection of elements of the same data type, stored in contiguous memory locations.',
            hint: 'It\'s a way to store multiple values of the same kind.'
        },
        {
            id: 'T013',
            question: 'How do you declare an array named `numbers` that can hold 10 integers?',
            options: [
                'int numbers[10];',
                'int numbers = 10;',
                'array numbers[10];',
                'int[] numbers = 10;'
            ],
            correctAnswer: 'int numbers[10];',
            explanation: 'Arrays are declared by specifying the data type, followed by the array name, and then the size in square brackets `[]`.',
            hint: 'The size goes inside square brackets.'
        },
        {
            id: 'T014',
            question: 'What is the index of the first element in a C array?',
            options: [
                '1',
                '0',
                'Any positive integer',
                'The size of the array'
            ],
            correctAnswer: '0',
            explanation: 'C arrays are zero-indexed, meaning the first element is at index 0, the second at index 1, and so on.',
            hint: 'Most programming languages start counting from this number for arrays.'
        },
        {
            id: 'T015',
            question: 'What is a string in C?',
            options: [
                'A sequence of integers',
                'A collection of floating-point numbers',
                'An array of characters terminated by a null character (\\0)',
                'A special type of function'
            ],
            correctAnswer: 'An array of characters terminated by a null character (\\0)',
            explanation: 'In C, strings are essentially character arrays that are null-terminated, meaning they end with a special character `\\0` to mark the end of the string.',
            hint: 'It\'s an array, but with a specific ending character.'
        },
        {
            id: 'T016',
            question: 'Which function is used to compare two strings in C?',
            options: [
                'strcpy()',
                'strcat()',
                'strlen()',
                'strcmp()'
            ],
            correctAnswer: 'strcmp()',
            explanation: 'The `strcmp()` function (from `string.h`) compares two strings lexicographically and returns 0 if they are equal, a negative value if the first is less than the second, and a positive value otherwise.',
            hint: 'Its name suggests "string comparison".'
        },
        {
            id: 'T017',
            question: 'What is the purpose of `malloc()` and `free()` functions?',
            options: [
                'For file input/output operations',
                'For dynamic memory allocation and deallocation',
                'For string manipulation',
                'For mathematical calculations'
            ],
            correctAnswer: 'For dynamic memory allocation and deallocation',
            explanation: '`malloc()` (memory allocation) is used to allocate a block of memory dynamically during program execution, and `free()` is used to deallocate that memory, preventing memory leaks.',
            hint: 'They deal with memory management during runtime.'
        },
        {
            id: 'T018',
            question: 'What is a `struct` in C?',
            options: [
                'A built-in data type like `int` or `char`',
                'A collection of variables of different data types under a single name',
                'A function that returns a pointer',
                'A way to define constants'
            ],
            correctAnswer: 'A collection of variables of different data types under a single name',
            explanation: 'A `struct` (structure) is a user-defined data type that allows you to combine items of different data types into a single unit.',
            hint: 'It allows you to group related but different types of data.'
        },
        {
            id: 'T019',
            question: 'What is recursion in C programming?',
            options: [
                'A loop that never ends',
                'A function calling itself directly or indirectly',
                'A way to define macros',
                'A method for error handling'
            ],
            correctAnswer: 'A function calling itself directly or indirectly',
            explanation: 'Recursion is a programming technique where a function calls itself to solve a problem, typically breaking it down into smaller, similar subproblems.',
            hint: 'Think about a function that repeats its own action.'
        },
        {
            id: 'T020',
            question: 'What is the role of `break` statement in loops?',
            options: [
                'To skip the current iteration and continue with the next',
                'To terminate the loop immediately',
                'To restart the loop from the beginning',
                'To define a new loop'
            ],
            correctAnswer: 'To terminate the loop immediately',
            explanation: 'The `break` statement is used to exit from a loop (for, while, do-while) or a `switch` statement immediately, transferring control to the statement immediately following the loop/switch.',
            hint: 'It stops the loop entirely.'
        }
    ],
    practical: [
        {
            id: 'P001',
            question: 'Write a C program to print "Hello, HICKS BOZON404!" to the console.',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    printf("Hello, HICKS BOZON404!\\n");\n    return 0;\n}`,
            hint: 'Use the `printf` function from the `stdio.h` library. Remember to include a newline character.',
            explanation: 'This program includes the `stdio.h` header for input/output functions. The `main` function is the entry point. `printf()` is used to display the string, and `\\n` adds a newline. `return 0;` indicates successful execution.'
        },
        {
            id: 'P002',
            question: 'Write a C program to add two integers, `a = 5` and `b = 10`, and print their sum.',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    int a = 5;\n    int b = 10;\n    // Write your code here\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    int a = 5;\n    int b = 10;\n    int sum = a + b;\n    printf("Sum: %d\\n", sum);\n    return 0;\n}`,
            hint: 'Declare a variable to store the sum. Use `printf` with a format specifier for integers (%d).',
            explanation: 'Variables `a` and `b` are initialized. Their sum is stored in `sum`. `printf` displays the result using `%d` as a placeholder for the integer value of `sum`.'
        },
        {
            id: 'P003',
            question: 'Write a C program to find the larger of two numbers, `x = 7` and `y = 3`. Print the larger number.',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    int x = 7;\n    int y = 3;\n    // Write your code here\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    int x = 7;\n    int y = 3;\n    if (x > y) {\n        printf("Larger number: %d\\n", x);\n    } else {\n        printf("Larger number: %d\\n", y);\n    }\n    return 0;\n}`,
            hint: 'Use an `if-else` statement to compare `x` and `y`.',
            explanation: 'An `if-else` statement checks if `x` is greater than `y`. The corresponding `printf` statement then displays the larger value.'
        },
        {
            id: 'P004',
            question: 'Write a C program to check if a given integer `num = 6` is even or odd. Print "Even" or "Odd".',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    int num = 6;\n    // Write your code here\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    int num = 6;\n    if (num % 2 == 0) {\n        printf("Even\\n");\n    } else {\n        printf("Odd\\n");\n    }\n    return 0;\n}`,
            hint: 'Use the modulo operator (`%`) to check for divisibility by 2.',
            explanation: 'The modulo operator (`%`) gives the remainder of a division. If `num % 2` is 0, the number is even; otherwise, it\'s odd.'
        },
        {
            id: 'P005',
            question: 'Write a C program to print numbers from 1 to 5 using a `for` loop.',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    for (int i = 1; i <= 5; i++) {\n        printf("%d\\n", i);\n    }\n    return 0;\n}`,
            hint: 'Initialize a loop counter, set a condition, and increment the counter.',
            explanation: 'The `for` loop initializes `i` to 1, continues as long as `i` is less than or equal to 5, and increments `i` in each iteration. `printf` prints the value of `i`.'
        },
        {
            id: 'P006',
            question: 'Write a C program to calculate the factorial of a number `n = 4`.',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    int n = 4;\n    long long factorial = 1;\n    // Write your code here\n    printf("Factorial of %d = %lld\\n", n, factorial);\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    int n = 4;\n    long long factorial = 1;\n    for (int i = 1; i <= n; i++) {\n        factorial *= i;\n    }\n    printf("Factorial of %d = %lld\\n", n, factorial);\n    return 0;\n}`,
            hint: 'Use a loop to multiply numbers from 1 to `n`. Use `long long` for `factorial` to handle larger values.',
            explanation: 'A `for` loop iterates from 1 to `n`, multiplying `factorial` by the current iteration number. `%lld` is used for printing `long long`.'
        },
        {
            id: 'P007',
            question: 'Write a C program to reverse a given string "hello".',
            codeTemplate: `#include <stdio.h>\n#include <string.h>\n\nint main() {\n    char str[] = "hello";\n    // Write your code here\n    printf("Reversed string: %s\\n", str);\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n#include <string.h>\n\nint main() {\n    char str[] = "hello";\n    int length = strlen(str);\n    for (int i = 0; i < length / 2; i++) {\n        char temp = str[i];\n        str[i] = str[length - 1 - i];\n        str[length - 1 - i] = temp;\n    }\n    printf("Reversed string: %s\\n", str);\n    return 0;\n}`,
            hint: 'You\'ll need `string.h` for `strlen`. Swap characters from the beginning and end of the string.',
            explanation: 'The program uses `strlen()` to get the string length. A `for` loop iterates up to half the length, swapping characters from opposite ends of the string using a temporary variable.'
        },
        {
            id: 'P008',
            question: 'Write a C program to calculate the sum of elements in an array `int arr[] = {1, 2, 3, 4, 5};`.',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    int arr[] = {1, 2, 3, 4, 5};\n    int n = sizeof(arr) / sizeof(arr[0]);\n    int sum = 0;\n    // Write your code here\n    printf("Sum of array elements: %d\\n", sum);\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    int arr[] = {1, 2, 3, 4, 5};\n    int n = sizeof(arr) / sizeof(arr[0]);\n    int sum = 0;\n    for (int i = 0; i < n; i++) {\n        sum += arr[i];\n    }\n    printf("Sum of array elements: %d\\n", sum);\n    return 0;\n}`,
            hint: 'Loop through the array elements and add each to a `sum` variable.',
            explanation: 'A `for` loop iterates from index 0 to `n-1` (where `n` is the array size). In each iteration, the current array element is added to `sum`.'
        },
        {
            id: 'P009',
            question: 'Write a C program to swap two numbers `a = 10` and `b = 20` using a temporary variable. Print `a` and `b` after swapping.',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    int a = 10;\n    int b = 20;\n    // Write your code here\n    printf("After swap: a = %d, b = %d\\n", a, b);\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    int a = 10;\n    int b = 20;\n    int temp = a;\n    a = b;\n    b = temp;\n    printf("After swap: a = %d, b = %d\\n", a, b);\n    return 0;\n}`,
            hint: 'Use a third variable to temporarily hold one of the values.',
            explanation: 'A `temp` variable stores the value of `a`. Then `a` is assigned `b`\'s value, and `b` is assigned `temp`\'s (original `a`\'s) value, effectively swapping them.'
        },
        {
            id: 'P010',
            question: 'Write a C program to find the largest element in an array `int arr[] = {12, 45, 2, 41, 9};`.',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    int arr[] = {12, 45, 2, 41, 9};\n    int n = sizeof(arr) / sizeof(arr[0]);\n    int max = arr[0];\n    // Write your code here\n    printf("Largest element: %d\\n", max);\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    int arr[] = {12, 45, 2, 41, 9};\n    int n = sizeof(arr) / sizeof(arr[0]);\n    int max = arr[0];\n    for (int i = 1; i < n; i++) {\n        if (arr[i] > max) {\n            max = arr[i];\n        }\n    }\n    printf("Largest element: %d\\n", max);\n    return 0;\n}`,
            hint: 'Assume the first element is the largest, then iterate and compare with subsequent elements.',
            explanation: 'The program initializes `max` with the first element. It then iterates through the rest of the array, updating `max` whenever a larger element is found.'
        },
        {
            id: 'P011',
            question: 'Write a C program to print the Fibonacci series up to 5 terms (0, 1, 1, 2, 3).',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    int n = 5;\n    int t1 = 0, t2 = 1;\n    int nextTerm;\n    printf("Fibonacci Series: ");\n    // Write your code here\n    printf("\\n");\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    int n = 5;\n    int t1 = 0, t2 = 1;\n    int nextTerm;\n    printf("Fibonacci Series: ");\n\n    for (int i = 1; i <= n; ++i) {\n        printf("%d, ", t1);\n        nextTerm = t1 + t2;\n        t1 = t2;\n        t2 = nextTerm;\n    }\n    printf("\\n");\n    return 0;\n}`,
            hint: 'The next term is the sum of the previous two. Start with 0 and 1.',
            explanation: 'The program initializes `t1` and `t2` to 0 and 1. It then loops `n` times, printing `t1`, calculating the `nextTerm`, and updating `t1` and `t2` for the next iteration.'
        },
        {
            id: 'P012',
            question: 'Write a C program to check if a number `num = 17` is prime or not.',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    int num = 17;\n    int isPrime = 1; // Assume prime\n    // Write your code here\n    if (isPrime && num > 1) {\n        printf("%d is a prime number.\\n", num);\n    } else {\n        printf("%d is not a prime number.\\n", num);\n    }\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    int num = 17;\n    int isPrime = 1; // Assume prime\n\n    if (num <= 1) {\n        isPrime = 0;\n    } else {\n        for (int i = 2; i <= num / 2; i++) {\n            if (num % i == 0) {\n                isPrime = 0;\n                break;\n            }\n        }\n    }\n\n    if (isPrime && num > 1) {\n        printf("%d is a prime number.\\n", num);\n    } else {\n        printf("%d is not a prime number.\\n", num);\n    }\n    return 0;\n}`,
            hint: 'A prime number is only divisible by 1 and itself. Check divisibility from 2 up to `num/2`.',
            explanation: 'The program handles cases for numbers less than or equal to 1. For others, it loops from 2 up to `num/2`. If `num` is divisible by any `i`, it\'s not prime, and `isPrime` is set to 0.'
        },
        {
            id: 'P013',
            question: 'Write a C program to calculate the sum of digits of a number `num = 123`.',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    int num = 123;\n    int sum = 0;\n    // Write your code here\n    printf("Sum of digits: %d\\n", sum);\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    int num = 123;\n    int sum = 0;\n    int originalNum = num;\n\n    while (num > 0) {\n        int digit = num % 10;\n        sum += digit;\n        num /= 10;\n    }\n\n    printf("Sum of digits of %d: %d\\n", originalNum, sum);\n    return 0;\n}`,
            hint: 'Use a `while` loop. Extract the last digit using modulo 10, add it to sum, and then divide the number by 10.',
            explanation: 'The `while` loop continues as long as `num` is greater than 0. In each iteration, it extracts the last digit using `% 10`, adds it to `sum`, and then removes the last digit by integer division (`/= 10`).'
        },
        {
            id: 'P014',
            question: 'Write a C program to convert a given temperature from Celsius to Fahrenheit. Celsius `C = 25`. Formula: $F = (C * 9/5) + 32$.',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    float celsius = 25.0;\n    float fahrenheit;\n    // Write your code here\n    printf("%.2f Celsius is %.2f Fahrenheit\\n", celsius, fahrenheit);\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    float celsius = 25.0;\n    float fahrenheit;\n    fahrenheit = (celsius * 9/5) + 32;\n    printf("%.2f Celsius is %.2f Fahrenheit\\n", celsius, fahrenheit);\n    return 0;\n}`,
            hint: 'Apply the given formula directly. Use `float` for precision.',
            explanation: 'The program directly applies the conversion formula. `float` data type is used for `celsius` and `fahrenheit` to handle decimal values, and `%.2f` is used in `printf` to format the output to two decimal places.'
        },
        {
            id: 'P015',
            question: 'Write a C program to find the average of three numbers `a = 10, b = 20, c = 30`.',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    int a = 10, b = 20, c = 30;\n    float average;\n    // Write your code here\n    printf("Average: %.2f\\n", average);\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    int a = 10, b = 20, c = 30;\n    float average;\n    average = (float)(a + b + c) / 3;\n    printf("Average: %.2f\\n", average);\n    return 0;\n}`,
            hint: 'Sum the numbers and divide by 3. Remember to cast to `float` for accurate division.',
            explanation: 'The sum of `a`, `b`, and `c` is calculated. This sum is then explicitly cast to `float` before dividing by 3 to ensure floating-point division and an accurate average. `%.2f` formats the output.'
        },
        {
            id: 'P016',
            question: 'Write a C program to check if a character `ch = \'A\'` is a vowel or a consonant.',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    char ch = 'A';\n    // Write your code here\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    char ch = 'A';\n\n    if (ch == 'a' || ch == 'e' || ch == 'i' || ch == 'o' || ch == 'u' ||\n        ch == 'A' || ch == 'E' || ch == 'I' || ch == 'O' || ch == 'U') {\n        printf("%c is a vowel.\\n", ch);\n    } else if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {\n        printf("%c is a consonant.\\n", ch);\n    } else {\n        printf("%c is not an alphabet.\\n", ch);\n    }\n    return 0;\n}`,
            hint: 'Use `if-else if` statements and logical OR (`||`) to check for both lowercase and uppercase vowels.',
            explanation: 'The program uses `if-else if` to check if `ch` matches any vowel (case-insensitively). If not a vowel, it checks if it\'s an alphabet character before declaring it a consonant.'
        },
        {
            id: 'P017',
            question: 'Write a C program to print numbers from 10 down to 1 using a `while` loop.',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    int i = 10;\n    // Write your code here\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    int i = 10;\n    while (i >= 1) {\n        printf("%d\\n", i);\n        i--;\n    }\n    return 0;\n}`,
            hint: 'Initialize a counter and decrement it until it reaches 1.',
            explanation: 'A `while` loop continues as long as `i` is greater than or equal to 1. In each iteration, `i` is printed, and then decremented.'
        },
        {
            id: 'P018',
            question: 'Write a C program to calculate the power of a number `base = 2`, `exponent = 3`. (i.e., $2^3 = 8$).',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    int base = 2;\n    int exponent = 3;\n    long long result = 1;\n    // Write your code here\n    printf("%d^%d = %lld\\n", base, exponent, result);\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    int base = 2;\n    int exponent = 3;\n    long long result = 1;\n\n    for (int i = 0; i < exponent; i++) {\n        result *= base;\n    }\n\n    printf("%d^%d = %lld\\n", base, exponent, result);\n    return 0;\n}`,
            hint: 'Use a loop that runs `exponent` times, multiplying `result` by `base` in each iteration.',
            explanation: 'A `for` loop iterates `exponent` times. In each iteration, `result` is multiplied by `base`, effectively calculating `base` raised to the `exponent` power.'
        },
        {
            id: 'P019',
            question: 'Write a C program to check if a year `year = 2024` is a leap year. (A leap year is divisible by 4, but not by 100 unless it is also divisible by 400).',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    int year = 2024;\n    // Write your code here\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    int year = 2024;\n\n    if ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)) {\n        printf("%d is a leap year.\\n", year);\n    } else {\n        printf("%d is not a leap year.\\n", year);\n    }\n    return 0;\n}`,
            hint: 'Use logical operators (`&&`, `||`) to implement the leap year conditions.',
            explanation: 'The program uses a conditional statement to check the leap year rules: divisible by 4 AND not by 100, OR divisible by 400. If either condition is true, it\'s a leap year.'
        },
        {
            id: 'P020',
            question: 'Write a C program to print the multiplication table of a number `num = 7` up to 10.',
            codeTemplate: `#include <stdio.h>\n\nint main() {\n    int num = 7;\n    // Write your code here\n    return 0;\n}`,
            correctAnswer: `#include <stdio.h>\n\nint main() {\n    int num = 7;\n    printf("Multiplication Table of %d:\\n", num);\n    for (int i = 1; i <= 10; i++) {\n        printf("%d x %d = %d\\n", num, i, num * i);\n    }\n    return 0;\n}`,
            hint: 'Use a `for` loop to iterate from 1 to 10 and print the product.',
            explanation: 'A `for` loop iterates from 1 to 10. In each iteration, it prints the multiplication expression and its result using `printf`.'
        }
    ]
};

// Initialize app.questions with initial questions
app.questions.theory = [...app.initialQuestions.theory];
app.questions.practical = [...app.initialQuestions.practical];

// --- Firebase Data Operations ---

// Load user's quiz history and generated questions
app.loadHistory = async () => {
    if (!isAuthReady) {
        console.warn('Firebase Auth not ready, cannot load history yet.');
        return;
    }
    try {
        const historyCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/quizHistory`);
        onSnapshot(historyCollectionRef, (snapshot) => {
            app.history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log('History loaded:', app.history);
            // Re-render history if on history screen
            if (mainContent.dataset.screen === 'history') {
                app.renderHistoryScreen();
            }
        }, (error) => {
            console.error('Error listening to history:', error);
            app.showModal(`Error loading history: ${error.message}`, 'OK');
        });

        const generatedQuestionsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/generatedQuestions`);
        onSnapshot(generatedQuestionsCollectionRef, (snapshot) => {
            const newGeneratedTheory = [];
            const newGeneratedPractical = [];
            snapshot.docs.forEach(doc => {
                const q = doc.data();
                if (q.type === 'theory') {
                    newGeneratedTheory.push({ id: doc.id, ...q });
                } else if (q.type === 'practical') {
                    newGeneratedPractical.push({ id: doc.id, ...q });
                }
            });

            // Merge generated questions with initial ones, ensuring uniqueness
            app.questions.theory = [...app.initialQuestions.theory]; // Start fresh with initial
            newGeneratedTheory.forEach(gq => {
                if (!app.questions.theory.some(q => q.id === gq.id)) {
                    app.questions.theory.push(gq);
                }
            });

            app.questions.practical = [...app.initialQuestions.practical]; // Start fresh with initial
            newGeneratedPractical.forEach(gq => {
                if (!app.questions.practical.some(q => q.id === gq.id)) {
                    app.questions.practical.push(gq);
                }
            });

            console.log('Generated questions loaded and merged.');
            console.log('Total Theory Questions:', app.questions.theory.length);
            console.log('Total Practical Questions:', app.questions.practical.length);
        }, (error) => {
            console.error('Error listening to generated questions:', error);
            app.showModal(`Error loading generated questions: ${error.message}`, 'OK');
        });

    } catch (error) {
        console.error('Error setting up Firestore listeners:', error);
        app.showModal(`Error setting up data sync: ${error.message}`, 'OK');
    }
};

// Save quiz result to history
app.saveQuizResult = async (questionId, questionType, isCorrect, userAnswer, correctAnswer, explanation) => {
    if (!isAuthReady) {
        console.warn('Firebase Auth not ready, cannot save history.');
        return;
    }
    try {
        const historyCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/quizHistory`);
        await addDoc(historyCollectionRef, {
            questionId,
            questionType,
            isCorrect,
            userAnswer: userAnswer ? JSON.stringify(userAnswer) : null, // Stringify complex objects
            correctAnswer: correctAnswer ? JSON.stringify(correctAnswer) : null, // Stringify complex objects
            timestamp: serverTimestamp()
        });
        console.log('Quiz result saved.');
    } catch (error) {
        console.error('Error saving quiz result:', error);
        app.showModal(`Error saving quiz result: ${error.message}`, 'OK');
    }
};

// Save a newly generated question
app.saveGeneratedQuestion = async (questionData) => {
    if (!isAuthReady) {
        console.warn('Firebase Auth not ready, cannot save generated question.');
        return;
    }
    try {
        const generatedQuestionsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/generatedQuestions`);
        // Add a new document and let Firestore generate the ID
        const docRef = await addDoc(generatedQuestionsCollectionRef, {
            ...questionData,
            timestamp: serverTimestamp()
        });
        console.log('Generated question saved with ID:', docRef.id);
        // Update the question's ID to match the Firestore ID for future reference
        questionData.id = docRef.id;
        return questionData;
    } catch (error) {
        console.error('Error saving generated question:', error);
        app.showModal(`Error saving generated question: ${error.message}`, 'OK');
        return null;
    }
};

// --- UI Rendering Functions ---

app.renderHomeScreen = () => {
    mainContent.dataset.screen = 'home';
    mainContent.innerHTML = `
        <div class="flex flex-col items-center justify-center p-4 space-y-6">
            <h2 class="text-3xl font-bold text-gray-800 mb-6 text-center">Welcome to HICKS BOZON404</h2>
            <p class="text-lg text-gray-600 text-center max-w-md">Master C programming with theory and practical quizzes. Generate new questions anytime!</p>

            <div class="w-full max-w-sm flex flex-col space-y-4">
                <button id="start-theory-quiz-btn" class="btn btn-primary w-full">Start Theory Quiz (20 Qs)</button>
                <button id="start-practical-quiz-btn" class="btn btn-primary w-full">Start Practical Quiz (20 Qs)</button>
                <button id="generate-theory-btn" class="btn btn-secondary w-full">Generate New Theory Questions</button>
                <button id="generate-practical-btn" class="btn btn-secondary w-full">Generate New Practical Questions</button>
                <button id="history-btn" class="btn btn-secondary w-full">View Quiz History</button>
            </div>
            <p class="text-sm text-gray-500 mt-4">Your User ID: ${userId}</p>
        </div>
    `;

    document.getElementById('start-theory-quiz-btn').addEventListener('click', () => app.startQuiz('theory'));
    document.getElementById('start-practical-quiz-btn').addEventListener('click', () => app.startQuiz('practical'));
    document.getElementById('generate-theory-btn').addEventListener('click', () => app.generateQuestions('theory'));
    document.getElementById('generate-practical-btn').addEventListener('click', () => app.generateQuestions('practical'));
    document.getElementById('history-btn').addEventListener('click', app.renderHistoryScreen);
};

app.renderQuizScreen = () => {
    mainContent.dataset.screen = 'quiz';
    const currentQuestion = app.currentQuiz.questions[app.currentQuiz.currentIndex];

    if (!currentQuestion) {
        app.showModal('Quiz completed!', 'OK', app.renderHomeScreen);
        return;
    }

    let questionHtml = '';
    if (app.currentQuiz.type === 'theory') {
        questionHtml = `
            <h3 class="text-xl font-semibold mb-4 text-gray-800">Question ${app.currentQuiz.currentIndex + 1}/${app.currentQuiz.questions.length} (Theory)</h3>
            <p class="text-lg mb-6 text-gray-700">${currentQuestion.question}</p>
            <div id="options-container" class="space-y-3 mb-6">
                ${currentQuestion.options.map((option, index) => `
                    <button class="option-btn btn btn-secondary w-full text-left" data-option="${option}">
                        ${String.fromCharCode(65 + index)}. ${option}
                    </button>
                `).join('')}
            </div>
            <div id="feedback-area" class="mt-4 p-3 rounded-lg text-white font-medium hidden"></div>
            <div id="explanation-area" class="mt-4 p-3 bg-blue-100 text-blue-800 rounded-lg hidden"></div>
            <div class="flex justify-between items-center mt-6">
                <button id="hint-btn" class="btn btn-yellow">Hint</button>
                <button id="next-question-btn" class="btn btn-primary hidden">Next Question</button>
            </div>
        `;
    } else { // Practical
        questionHtml = `
            <h3 class="text-xl font-semibold mb-4 text-gray-800">Question ${app.currentQuiz.currentIndex + 1}/${app.currentQuiz.questions.length} (Practical)</h3>
            <p class="text-lg mb-6 text-gray-700">${currentQuestion.question}</p>
            <div class="bg-gray-100 p-4 rounded-lg mb-4">
                <label for="code-editor" class="block text-sm font-medium text-gray-700 mb-2">Write your C code here:</label>
                <textarea id="code-editor" class="code-editor w-full" rows="10" placeholder="Type your C code here...">${currentQuestion.codeTemplate || ''}</textarea>
            </div>
            <div id="feedback-area" class="mt-4 p-3 rounded-lg text-white font-medium hidden"></div>
            <div id="explanation-area" class="mt-4 p-3 bg-blue-100 text-blue-800 rounded-lg hidden"></div>
            <div class="flex justify-between items-center mt-6">
                <button id="hint-btn" class="btn btn-yellow">Hint</button>
                <button id="give-up-btn" class="btn btn-red">Give Up</button>
                <button id="submit-code-btn" class="btn btn-green">Submit Code</button>
                <button id="next-question-btn" class="btn btn-primary hidden">Next Question</button>
            </div>
        `;
    }

    mainContent.innerHTML = `
        <div class="content-padding flex flex-col h-full">
            ${questionHtml}
        </div>
    `;

    // Add event listeners
    if (app.currentQuiz.type === 'theory') {
        document.querySelectorAll('.option-btn').forEach(button => {
            button.addEventListener('click', app.handleTheoryAnswer);
        });
    } else {
        document.getElementById('submit-code-btn').addEventListener('click', app.handleSubmitCode);
        document.getElementById('give-up-btn').addEventListener('click', app.handleGiveUp);
    }
    document.getElementById('hint-btn').addEventListener('click', app.showHint);
    document.getElementById('next-question-btn').addEventListener('click', app.nextQuestion);
};

app.renderHistoryScreen = () => {
    mainContent.dataset.screen = 'history';
    if (!isAuthReady) {
        mainContent.innerHTML = `
            <div class="p-6 text-center text-gray-600">
                <p>Loading history... Please wait for authentication.</p>
            </div>
        `;
        return;
    }

    if (app.history.length === 0) {
        mainContent.innerHTML = `
            <div class="p-6 text-center text-gray-600">
                <h2 class="text-2xl font-bold mb-4">Quiz History</h2>
                <p>No quiz history available yet. Start a quiz to see your progress!</p>
                <button id="back-to-home-btn" class="btn btn-secondary mt-6">Back to Home</button>
            </div>
        `;
        document.getElementById('back-to-home-btn').addEventListener('click', app.renderHomeScreen);
        return;
    }

    // Sort history by timestamp descending
    const sortedHistory = [...app.history].sort((a, b) => b.timestamp - a.timestamp);

    mainContent.innerHTML = `
        <div class="content-padding">
            <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Quiz History</h2>
            <div class="space-y-4">
                ${sortedHistory.map(entry => `
                    <div class="p-4 rounded-lg shadow-sm ${entry.isCorrect ? 'bg-green-50' : 'bg-red-50'} border ${entry.isCorrect ? 'border-green-200' : 'border-red-200'}">
                        <p class="font-semibold text-gray-800">${entry.questionType === 'theory' ? 'Theory' : 'Practical'} Question (ID: ${entry.questionId})</p>
                        <p class="text-sm text-gray-600">Status: <span class="font-bold ${entry.isCorrect ? 'text-green-600' : 'text-red-600'}">${entry.isCorrect ? 'Correct' : 'Incorrect'}</span></p>
                        ${entry.userAnswer ? `<p class="text-sm text-gray-600">Your Answer: <span class="font-mono text-xs break-words">${JSON.parse(entry.userAnswer)}</span></p>` : ''}
                        ${entry.correctAnswer ? `<p class="text-sm text-gray-600">Correct Answer: <span class="font-mono text-xs break-words">${JSON.parse(entry.correctAnswer)}</span></p>` : ''}
                        <p class="text-xs text-gray-500">Date: ${new Date(entry.timestamp.toDate()).toLocaleString()}</p>
                    </div>
                `).join('')}
            </div>
            <button id="back-to-home-btn" class="btn btn-secondary w-full mt-6">Back to Home</button>
        </div>
    `;
    document.getElementById('back-to-home-btn').addEventListener('click', app.renderHomeScreen);
};

// --- Quiz Logic ---

app.startQuiz = (type) => {
    app.currentQuiz.type = type;
    // Shuffle questions and select the first 20 (or fewer if not enough)
    const availableQuestions = [...app.questions[type]];
    for (let i = availableQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableQuestions[i], availableQuestions[j]] = [availableQuestions[j], availableQuestions[i]];
    }
    app.currentQuiz.questions = availableQuestions.slice(0, 20);
    app.currentQuiz.currentIndex = 0;
    app.currentQuiz.userAnswers = {};
    app.currentQuiz.attempts = {}; // Reset attempts for new quiz
    app.renderQuizScreen();
};

app.showFeedback = (message, isCorrect) => {
    const feedbackArea = document.getElementById('feedback-area');
    feedbackArea.textContent = message;
    feedbackArea.classList.remove('hidden', 'bg-green-500', 'bg-red-500');
    feedbackArea.classList.add(isCorrect ? 'bg-green-500' : 'bg-red-500');
    document.getElementById('next-question-btn').classList.remove('hidden');
    document.getElementById('hint-btn').classList.add('hidden'); // Hide hint after answer
};

app.showExplanation = (explanation) => {
    const explanationArea = document.getElementById('explanation-area');
    explanationArea.innerHTML = `<strong>Explanation:</strong> ${explanation}`;
    explanationArea.classList.remove('hidden');
};

app.handleTheoryAnswer = (event) => {
    const selectedOption = event.target.dataset.option;
    const currentQuestion = app.currentQuiz.questions[app.currentQuiz.currentIndex];
    const feedbackArea = document.getElementById('feedback-area');
    const optionsContainer = document.getElementById('options-container');

    // Disable all option buttons after selection
    optionsContainer.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = true;
        btn.classList.remove('btn-secondary');
        if (btn.dataset.option === currentQuestion.correctAnswer) {
            btn.classList.add('bg-green-200', 'text-green-800'); // Highlight correct answer
        }
    });

    if (!app.currentQuiz.attempts[currentQuestion.id]) {
        app.currentQuiz.attempts[currentQuestion.id] = 0;
    }
    app.currentQuiz.attempts[currentQuestion.id]++;

    const isCorrect = (selectedOption === currentQuestion.correctAnswer);
    app.userAnswers[currentQuestion.id] = selectedOption; // Store user's last attempt

    if (isCorrect) {
        app.showFeedback('Correct! Well done.', true);
        app.showExplanation(currentQuestion.explanation);
        app.saveQuizResult(currentQuestion.id, 'theory', true, selectedOption, currentQuestion.correctAnswer, currentQuestion.explanation);
    } else {
        event.target.classList.remove('btn-secondary');
        event.target.classList.add('bg-red-200', 'text-red-800'); // Highlight incorrect selection

        if (app.currentQuiz.attempts[currentQuestion.id] >= 2) {
            app.showFeedback('Incorrect. The correct answer was provided.', false);
            app.showExplanation(`The correct answer is: <strong>${currentQuestion.correctAnswer}</strong>. ${currentQuestion.explanation}`);
            app.saveQuizResult(currentQuestion.id, 'theory', false, selectedOption, currentQuestion.correctAnswer, currentQuestion.explanation);
        } else {
            app.showFeedback('Incorrect. Try again!', false);
            // Re-enable buttons for another attempt
            optionsContainer.querySelectorAll('.option-btn').forEach(btn => {
                if (btn.dataset.option !== selectedOption) { // Only re-enable other incorrect options
                    btn.disabled = false;
                    btn.classList.add('btn-secondary');
                    btn.classList.remove('bg-red-200', 'text-red-800');
                }
            });
            document.getElementById('next-question-btn').classList.add('hidden'); // Hide next button until correct or 2 attempts
            document.getElementById('hint-btn').classList.remove('hidden'); // Show hint again
        }
    }
};

app.handleSubmitCode = () => {
    const codeEditor = document.getElementById('code-editor');
    const userAnswer = codeEditor.value;
    const currentQuestion = app.currentQuiz.questions[app.currentQuiz.currentIndex];

    // Simple string comparison for correctness. In a real app, this would need a C compiler/interpreter.
    // For now, we'll strip whitespace for a more lenient comparison.
    const normalizedUserAnswer = userAnswer.replace(/\s/g, '').trim();
    const normalizedCorrectAnswer = currentQuestion.correctAnswer.replace(/\s/g, '').trim();

    const isCorrect = (normalizedUserAnswer === normalizedCorrectAnswer);

    if (isCorrect) {
        app.showFeedback('Correct! Your code matches the solution.', true);
        app.showExplanation(currentQuestion.explanation);
        app.saveQuizResult(currentQuestion.id, 'practical', true, userAnswer, currentQuestion.correctAnswer, currentQuestion.explanation);
    } else {
        app.showFeedback('Your code is incorrect. Keep trying or ask for a hint!', false);
        document.getElementById('hint-btn').classList.remove('hidden');
    }
    document.getElementById('next-question-btn').classList.remove('hidden');
    document.getElementById('submit-code-btn').classList.add('hidden'); // Hide submit after first attempt
    document.getElementById('give-up-btn').classList.add('hidden'); // Hide give up after first attempt
    codeEditor.disabled = true; // Disable editor after submission
};

app.handleGiveUp = () => {
    const currentQuestion = app.currentQuiz.questions[app.currentQuiz.currentIndex];
    const codeEditor = document.getElementById('code-editor');

    app.showModal('Are you sure you want to give up? The correct answer will be revealed.', 'CONFIRM', () => {
        app.showFeedback('You gave up. Here is the correct solution.', false);
        app.showExplanation(`<strong>Correct Solution:</strong><pre class="code-editor mt-2">${currentQuestion.correctAnswer}</pre><br>${currentQuestion.explanation}`);
        codeEditor.value = currentQuestion.correctAnswer;
        codeEditor.disabled = true;
        app.saveQuizResult(currentQuestion.id, 'practical', false, codeEditor.value, currentQuestion.correctAnswer, currentQuestion.explanation);
        document.getElementById('next-question-btn').classList.remove('hidden');
        document.getElementById('submit-code-btn').classList.add('hidden');
        document.getElementById('hint-btn').classList.add('hidden');
        document.getElementById('give-up-btn').classList.add('hidden');
    });
};

app.showHint = () => {
    const currentQuestion = app.currentQuiz.questions[app.currentQuiz.currentIndex];
    app.showModal(`<strong>Hint:</strong> ${currentQuestion.hint}`, 'OK');
};

app.nextQuestion = () => {
    app.currentQuiz.currentIndex++;
    app.renderQuizScreen();
};

// --- AI Question Generation ---

app.generateQuestions = async (type) => {
    app.showModal(`Generating 20 new ${type} questions... This may take a moment.`, 'OK');
    const loadingMessageId = 'loading-questions-modal'; // Unique ID for this modal state

    // Update the modal content to show a spinner or progress if needed
    modalMessage.innerHTML = `<div class="flex flex-col items-center">
                                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                                <p>Generating 20 new ${type} questions... This may take a moment.</p>
                              </div>`;
    customModal.classList.add('active'); // Ensure modal is active

    try {
        const generatedQuestions = [];
        const promptType = type === 'theory' ? 'multiple choice theory' : 'practical coding';

        // Generate questions one by one or in batches if API supports
        // For simplicity and to manage API calls, let's do one call for 20 questions
        // The LLM will generate an array of questions.
        const prompt = `Generate 20 unique C programming ${promptType} questions.
        For theory questions, provide:
        - id (unique string, e.g., 'GT001')
        - question (string)
        - options (array of 4 strings)
        - correctAnswer (string, one of the options)
        - explanation (string, brief explanation of the correct answer)
        - hint (string, a subtle hint)

        For practical coding questions, provide:
        - id (unique string, e.g., 'GP001')
        - question (string, describing the coding task)
        - codeTemplate (string, basic C code structure for the user to fill, e.g., #include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n})
        - correctAnswer (string, the complete correct C code solution)
        - explanation (string, brief explanation of the solution)
        - hint (string, a subtle hint for coding)

        Ensure the questions cover a range of C programming concepts (variables, data types, operators, control structures, arrays, strings, functions, pointers, structs, file I/O, memory management, etc.).
        The response should be a JSON array of question objects. Do NOT include any conversational text outside the JSON.`;

        let chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });

        const payload = {
            contents: chatHistory,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            "id": { "type": "STRING" },
                            "question": { "type": "STRING" },
                            "options": {
                                "type": "ARRAY",
                                "items": { "type": "STRING" }
                            },
                            "correctAnswer": { "type": "STRING" },
                            "explanation": { "type": "STRING" },
                            "hint": { "type": "STRING" },
                            "codeTemplate": { "type": "STRING" }
                        },
                        // Define property ordering based on type for better schema adherence
                        "propertyOrdering": type === 'theory' ?
                            ["id", "question", "options", "correctAnswer", "explanation", "hint"] :
                            ["id", "question", "codeTemplate", "correctAnswer", "explanation", "hint"]
                    }
                }
            }
        };

        const apiKey = ""; // Canvas will provide this at runtime
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const jsonString = result.candidates[0].content.parts[0].text;
            const newQuestions = JSON.parse(jsonString);

            for (const q of newQuestions) {
                // Assign a unique ID if the AI didn't provide one, or ensure it's unique
                q.id = `${type.toUpperCase().charAt(0)}${Math.random().toString(36).substring(2, 9)}`;
                q.type = type; // Add type to the question object

                // Save to Firestore and add to local app.questions
                const savedQuestion = await app.saveGeneratedQuestion(q);
                if (savedQuestion) {
                    // This will be automatically updated by the onSnapshot listener for `generatedQuestions`
                    // So no need to manually push to app.questions.theory/practical here.
                }
            }
            app.showModal(`Successfully generated and added ${newQuestions.length} new ${type} questions!`, 'OK');
        } else {
            throw new Error('No valid response from AI.');
        }

    } catch (error) {
        console.error('Error generating questions:', error);
        app.showModal(`Failed to generate questions: ${error.message}. Please try again.`, 'OK');
    } finally {
        // Ensure modal is closed or updated after generation attempt
        if (customModal.classList.contains('active') && modalMessage.textContent.includes('Generating')) {
            app.closeModal();
        }
    }
};

// --- Initial Render ---
// The splash screen logic calls initFirebase, which then calls renderHomeScreen.
// This ensures everything is loaded before the UI is shown.
