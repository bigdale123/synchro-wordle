// Simple text-based Wordle game for Synchronet BBSes
// Supports 40-column and 80-column modes
// Rewritten for compatibility with older Synchronet JS engine (no ES6 features)

load("sbbsdefs.js")

var MAX_ATTEMPTS = 6;
var WORD_LENGTH = 5;
var STATS_FILE = system.data_dir + "wordle_stats.json"

function loadStats() {
    var f = new File(STATS_FILE);
    var stats = {};
    if (f.exists && f.open("r")) {
        var content = f.readAll().join("\n");
        f.close();
        if (content.length > 0) {
            stats = JSON.parse(content);
        }
    }

    return stats;
}

function saveStats(stats) {
    var f = new File(STATS_FILE);
    if (f.open("w")) {
        f.write(JSON.stringify(stats));
        f.close();
    }
}


// Load word list from file
var WORDS = [];
var word_file = new File(js.exec_dir + "word-bank.csv");
if (word_file.open("r")) {
    WORDS = word_file.readAll();
    word_file.close();
}

// Function to check if a guess matches the word
function checkGuess(guess, word) {
    var result = [];
    var i;
    for (i = 0; i < WORD_LENGTH; i++) {
        if (guess.charAt(i) === word.charAt(i)) {
            result.push("G"); // Green - correct letter in correct position
        } else if (word.indexOf(guess.charAt(i)) !== -1) {
            result.push("Y"); // Yellow - correct letter in wrong position
        } else {
            result.push("B"); // Black - incorrect letter
        }
    }
    return result;
}

// Function to create an empty board (no Array.fill/map dependency)
function makeEmptyBoard() {
    var board = [];
    var i, j;
    for (i = 0; i < MAX_ATTEMPTS; i++) {
        var row = [];
        for (j = 0; j < WORD_LENGTH; j++) {
            row.push(" ");
        }
        board.push(row);
    }
    return board;
}

// Function to display the game board
function displayBoard(board, currentRow, mode) {
    var CTRL_A = "\x01";
    var columns = (mode === "80") ? 80 : 40;
    var i, j;

    for (i = 0; i < MAX_ATTEMPTS; i++) {
        var row = "";
        if (i < currentRow) {
            // Display filled rows
            for (j = 0; j < WORD_LENGTH; j++) {
                var current_letter = ANSWERS[i][j]
                switch (board[i][j]) {
                    case "G":
                        row += CTRL_A + "K" + CTRL_A + "2" + current_letter; // Green block
                        break;
                    case "Y":
                        row += CTRL_A + "K" + CTRL_A + "3" + current_letter; // Yellow block
                        break;
                    case "B":
                        row += CTRL_A + "K" + CTRL_A + "7" + current_letter; // White block
                        break;
                    default:
                        row += " ";
                        break;
                }
            }
        } else {
            // Display empty rows
            for (j = 0; j < WORD_LENGTH; j++) {
                row += "\xb0"; // light shade block
            }
        }
        row += CTRL_A + "N"; // Reset color
        console.putmsg(row + "\r\n");
    }
}

// Playing the Game
function playWordle(mode, game_mode) {
    var ANSWERS = [];
    var stats = loadStats();

    var word = "";
    
    if (game_mode === "daily") {
        if (!check_player_can_play(stats)) {
            console.putmsg("You've already played today!\r\n");
            console.putmsg("You can try practice mode though!\r\n"); 
            return;
        }
        else {
            console.putmsg("Testing\r\n");
        }
    }
    else if (game_mode === "practice") {
        word = WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
    }
    var board = makeEmptyBoard();
    var currentRow = 0;
    var gameOver = false; 

    while (!gameOver && currentRow < MAX_ATTEMPTS) {
        displayBoard(board, currentRow, mode);

        var guess = "";
        while (guess.length !== WORD_LENGTH) {
            console.putmsg("Enter your " + WORD_LENGTH + "-letter guess:\r\n");
            guess = console.getstr(WORD_LENGTH, K_UPPER);
            if (guess === null) {
                guess = ""; // user disconnected or aborted input
            }

            if (guess.length !== WORD_LENGTH) {
                console.putmsg("Please enter exactly " + WORD_LENGTH + " letters.\r\n");
            }
        }
        ANSWERS.push(guess);

        // Check if the guess is correct
        var result = checkGuess(guess, word);
        board[currentRow] = result;

        var allGreen = true;
        var i;
        for (i = 0; i < result.length; i++) {
            if (result[i] !== "G") {
                allGreen = false;
                break;
            }
        }

        currentRow++;

        if (allGreen) {
            console.putmsg("Congratulations! You guessed the word: " + word + "\r\n");
            gameOver = true;
        }
    }

    if (!gameOver) {
        console.putmsg("Game over! The word was: " + word + "\r\n");
    }

    displayBoard(board, currentRow, mode);
   

    if (game_mode == "daily") {
        if (!stats[user.alias]) {
            stats[user.alias] = {
                lastPlayed: "",
                wins: 0,
                losses: 0,
                streak: 0,
                maxStreak: 0
            }
        }
        var last_date_played = stats[user.alias].lastPlayed;
        stats[user.alias].lastPlayed = get_todays_date();
        // Win or Loss stat
        if(gameOver) {
            stats[user.alias].wins++;
            // streak calculation
            if (check_if_streak_valid(last_date_played)) {
                stats[user.alias].streak++;
            }
            else {
                stats[user.alias].streak = 1;
            }
            if (stats[user.alias].streak > stats[user.alias].maxStreak) {
                stats[user.alias].maxStreak = stats[user.alias].streak;
            }
        }
        else {
            stats[user.alias].losses++;
            stats[user.alias].streak = 0;
        }

        saveStats(stats);
    }
}

function check_if_streak_valid(last_date_played) {
    if (!last_date_played) { // edge case for new players
        return false;
    }
    // Dates should be handled this way to account for end of month rollovers
    var last_date = new Date(last_date_played + "T00:00:00");
    var today = new Date(get_todays_date() + "T00:00:00");

    var msPerDay = 24 * 60 * 60 * 1000;
    var delta_days = Math.round((today-last_date) / msPerDay);

    if (delta_days === 1) {
        return true;
    }
    else {
        return false;
    }
}

// Determine screen mode (40 or 80 columns)
function getScreenMode() {
    var screenWidth = console.screen_columns;
    return (screenWidth >= 80) ? "80" : "40";
}

function get_todays_date() {
    var date = new Date();
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    if (month < 10) { 
        month = "0"+month;
    }
    if (day < 10) {
        day = "0"+day;
    }
    return ""+year+"-"+month+"-"+day;
}

function check_player_can_play(stats) {
    var todays_date = get_todays_date();
    if (stats[user.alias] && stats[user.alias].lastPlayed === todays_date) {
        return false;
    }
    else {
        return true;
    }
}

function startWordle(mode) {
    var choice = "";
    while (choice !== ".") {
        console.clear();
        if (mode === "40") {
	          console.printfile(js.exec_dir + "banner.40col.msg"); // 7 Rows
	          console.putmsg("\r\n");
	          console.putmsg("Welcome to Wordle!\r\n");
	          console.putmsg("Guess the " + WORD_LENGTH + "-letter word in " + MAX_ATTEMPTS + " tries.\r\n");
	          console.putmsg("\r\n");
            console.putmsg("d) Daily  p) Practice  .) quit\r\n")
        }

        choice = console.getstr(1, K_UPPER);

        if (choice === "D"){
            playWordle(mode, "daily");
        }
        else if (choice === "P") {
            playWordle(mode, "practice");
        }
    }
}

// Start the game
var mode = getScreenMode();
startWordle(mode);
