// Define a class using a constructor function
function UniversityStudent() {
    this.studentID = "UNI_ID_001";
}

// Add a method to set the student's name
UniversityStudent.prototype.setStudentName =
    function (studentName) {
        this.name = studentName;
    };

// Add a method to greet the student
UniversityStudent.prototype.greetStudent =
    function () {
        console.log(
            "Hello, " + this.name +
            "! Your university ID is " + this.studentID
        );
    };

// Create an object using the UniversityStudent class
var newUniversityStudent = new UniversityStudent();

// Call the method to set the student's name
newUniversityStudent.setStudentName("Ashish");

// Call the method to greet the student
newUniversityStudent.greetStudent();