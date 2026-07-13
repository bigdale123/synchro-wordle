/////////////////////////////////////////////////////////////////////////////////
// Syncrho-Wordle
// Simple text-based Wordle game for Synchronet BBSes
// Author: Dylan Calvin
// 
// Supports 40-column and 80-column modes
// Written for compatibility with older Synchronet JS engine (no ES6 features)
/////////////////////////////////////////////////////////////////////////////////





load("sbbsdefs.js")

/////////////////////////////////////////
// Defaults
//
// Generally shouldn't need to be changed
/////////////////////////////////////////
var MAX_ATTEMPTS = 6;
var WORD_LENGTH = 5;
var STATS_FILE = system.data_dir + "wordle_stats.json"
var CTRL_A = "\x01";
var NEWLINE = "\r\n";




/**
 * @description Loads the primary word bank from 'word-bank.csv'.
 * Initializes the global WORDS array with all entries found in the file.
 * All loaded words are converted to uppercase for consistent game logic.
 */
var WORDS = [];
var word_file = new File(js.exec_dir + "word-bank.csv");
if (word_file.open("r")) {
    WORDS = word_file.readAll();
    word_file.close();
    for (var i = 0; i < WORDS.length; i++) {
        WORDS[i] = WORDS[i].toUpperCase();
    }
}

/**
 * @description Loads the valid word bank from 'valid-words.csv'.
 * Initializes the global VALID_WORDS array with all entries found in this file.
 * All loaded words are converted to uppercase for consistent game logic.
 */
var VALID_WORDS = [];
word_file = new File(js.exec_dir + "valid-words.csv");
if (word_file.open("r")) {
    VALID_WORDS = word_file.readAll();
    word_file.close();
    for (var i = 0; i < VALID_WORDS.length; i++) {
        VALID_WORDS[i] = VALID_WORDS[i].toUpperCase();
    }
}











/////////////////////////////////////////
// Helper Functions
//
// Small functions that do little tasks
/////////////////////////////////////////

/**
 * Loads word game statistics from the STATS_FILE.
 * If the file exists, it attempts to parse the content as JSON.
 * Initializes stats to an empty object if the file is missing or empty.
 * 
 * @returns {object} An object containing loaded or default stats.
 */
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




/**
 * Saves the provided game statistics object (stats) to the STATS_FILE.
 * Overwrites existing content if the file exists.
 * 
 * @param {object} stats - An object containing word game statistics.
 */
function saveStats(stats) {
    var f = new File(STATS_FILE);
    if (f.open("w")) {
        f.write(JSON.stringify(stats));
        f.close();
    }
}




/**
 * Checks a user's guess against a secret word.
 * Returns an array representing the result for each letter:
 * "G" for green (correct letter and position),
 * "Y" for yellow (correct letter but wrong position),
 * "B" for black (letter not in the word).
 * 
 * @param {string} guess - The user's guess string.
 * @param {string} word - The secret word string to check against.
 * @returns {string[]} An array of characters ("G", "Y", or "B") representing the match status for each letter.
 */
function checkGuess(guess, word) {
    var result = [];
    var i;
    for (var i = 0; i < WORD_LENGTH; i++) {
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




/**
 * Creates an empty game board representation.
 * The board is a 2D array where each element represents an attempt's guess row.
 * It assumes MAX_ATTEMPTS and WORD_LENGTH are globally defined constants.
 * @returns {string[][]} A two-dimensional array representing the blank game board.
 */
function makeEmptyBoard() {
    var board = [];
    var i, j;
    for (var i = 0; i < MAX_ATTEMPTS; i++) {
        var row = [];
        for (j = 0; j < WORD_LENGTH; j++) {
            row.push(" ");
        }
        board.push(row);
    }
    return board;
}





/**
 * Checks if the user played yesterday, indicating a valid streak continuation.
 * @param {string} last_date_played The date of the last game play (YYYY-MM-DD).
 * @returns {boolean} True if the difference between today and last_date_played is exactly one day; otherwise, false.
 */
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




/**
 * Returns today's date formatted as YYYY-MM-DD.
 * @returns {string} Today's date (e.g., "2024-10-27").
 */
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





/**
 * Calculates and returns the Wordle puzzle word for the current day,
 * based on a pseudo-random seed derived from the date relative to an epoch (2020).
 * @returns {string} The daily Wordle word.
 */
function getDailyWord() {
    var today = get_todays_date().split("-");
    var date = new Date(parseInt(today[0]), parseInt(today[1]) - 1, parseInt(today[2]));
    var epoch = new Date(2020, 0, 1);
    var msPerDay = 24 * 60 * 60 * 1000;
    var seed = Math.round((date - epoch) / msPerDay);
    var index = seed % WORDS.length;
    return WORDS[index];
}


/**
 * Checks if the player associated with user alias can play today.
 * It checks if the last played date in stats is equal to today's date.
 * @param {object} stats - User statistics object containing activity records.
 * @returns {boolean} True if the player can play, false otherwise.
 */
function check_player_can_play(stats) {
    var todays_date = get_todays_date();
    if (stats[user.alias] && stats[user.alias].lastPlayed === todays_date) {
        return false;
    }
    else {
        return true;
    }
}






/**
 * Pads a string on the right with spaces until it reaches the specified width.
 * If the original string is already longer than the width, it truncates the string.
 * @param {string} str - The input string to pad.
 * @param {number} width - The target width of the resulting string.
 * @returns {string} The padded or truncated string.
 */
function padRight(str, width) {
    str = "" + str;
    if (str.length > width) {
        return str.substring(0, width);
    }
    while (str.length < width) {
        str += " ";
    }
    return str;
}

/**
 * Pads a string on the left with spaces until it reaches the specified width.
 * If the original string is already longer than the width, it truncates the string.
 * @param {string} str - The input string to pad.
 * @param {number} width - The target width of the resulting string.
 * @returns {string} The padded or truncated string.
 */
function padLeft(str, width) {
    str = "" + str;
    if (str.length > width) {
        return str.substring(0, width);
    }
    while (str.length < width) {
        str = " " + str;
    }
    return str;
}

/**
 * Repeats a given character 'ch' a specified number of times 'count'.
 * @param {string} ch - The character to repeat.
 * @param {number} count - The number of repetitions.
 * @returns {string} A string consisting of the character repeated 'count' times.
 */
function repeatChar(ch, count) {
    var out = "";
    var i;
    for (var i = 0; i < count; i++) {
        out += ch;
    }
    return out;
}

/**
 * Centers a string within a specified width by padding it with spaces.
 * @param {string} str - The string to center.
 * @param {number} width - The total desired width of the centered output.
 * @returns {string} The padded and centered string, or the original string if its visible length meets or exceeds the specified width.
 */
function centerText(str, width) {
    str = "" + str;
    var vLen = visibleLength(str);
    if (vLen >= width) {
        return str; // don't truncate blindly - substring would cut mid-codepair
    }
    var totalPad = width - vLen;
    var leftPad = Math.floor(totalPad / 2);
    var rightPad = totalPad - leftPad;
    return repeatChar(" ", leftPad) + str + repeatChar(" ", rightPad);
}

/**
 * Calculates the visible character length of a string by stripping special characters and newline sequences.
 * @param {string} str - The input string.
 * @returns {number} The visible length of the string.
 */
function visibleLength(str) {
    return str.replace(/\x01.|\r\n|\r|\n/g, "").length;
}

/**
 * Strips various newline sequences (\r\n, \r, \n) from the input text.
 * @param {*} text - The input value to strip newlines from.
 * @returns {string|*} The text with newlines removed, or the original value if it was not a string.
 */
function stripNewlines(text) {
    if (typeof text !== "string") {
        return text;
    }

    return text.replace(/\r\n|\r|\n/g, "");
}

/**
 * A wrapper function for printing text, ensuring full screen-width capability.
 * It checks the visible length of the text against the console's screen columns. 
 * If they match, it strips newlines before printing; otherwise, it prints the original text.
 * @param {string} text The text content to be printed.
 * @param {*} p_mode Print mode flag (P_NONE is used if undefined).
 * @param {number} orig_columns Original number of columns for formatting.
 */
function smartPrint(text, p_mode, orig_columns) {
    // This function is a wrapper to allow for full screen-width text
    // normally, printing 40 columns worth of text + a newline character causes an extra blank line to be printed.
    // This function checks the text length against the user's terminal width and adds a newline if the line is less than the user's terminal width.
    if (typeof p_mode === "undefined") {
        p_mode = P_NONE;
    }
    if (typeof orig_columns === "undefined") {
        orig_columns = 0;
    }


    if (visibleLength(text) === console.screen_columns) {
        console.putmsg(stripNewlines(text), p_mode, orig_columns);
    }
    else {
        console.putmsg(text, p_mode, orig_columns);
    }
}

/**
 * Generates the lines for the Wordle introduction card, detailing gameplay rules and examples.
 * @returns {Array<string>} An array of strings representing formatted text lines for the intro page.
 */
function generate_intro_card(){
    var intro_page_lines = [];
    intro_page_lines.push(centerText("",40));
    intro_page_lines.push(centerText("Welcome to Wordle!",40));
    intro_page_lines.push(centerText("Guess the " + WORD_LENGTH + "-letter word in " + MAX_ATTEMPTS + " tries.", 40));
    intro_page_lines.push(centerText("",40));
    intro_page_lines.push(centerText("",40));
    intro_page_lines.push(centerText(CTRL_A + "K" + CTRL_A + "2" + "(X)" + CTRL_A + "N" + " = Correct    ", 40));
    intro_page_lines.push(centerText("",40));
    intro_page_lines.push(centerText(CTRL_A + "K" + CTRL_A + "3" + "!X!" + CTRL_A + "N" + " = Misplaced  ", 40));
    intro_page_lines.push(centerText("",40));
    intro_page_lines.push(centerText(CTRL_A + "K" + CTRL_A + "7" + " X " + CTRL_A + "N" + " = Not in word", 40));

    return intro_page_lines;
}

/**
 * Generates an array of strings representing the formatted game board display.
 * @param {Array<Array<string>>} board - The board state (G/Y/B) for filled attempts.
 * @param {number} currentRow - The index of the current attempt row being played.
 * @param {Array<Array<string>>} ANSWERS - The letters guessed for each attempt.
 * @returns {Array<string>} An array of strings, where each three consecutive strings represent (Top, Mid, Bottom) lines for a row.
 */
function generateBoard(board, currentRow, ANSWERS) {
    var columns = 40;
    var lines = [];
    var i, j;

    for (var i = 0; i < MAX_ATTEMPTS; i++) {
        var topRow = "";
        var midRow = "";
        var botRow = "";

        if (i < currentRow) {
            // Display filled rows
            for (j = 0; j < WORD_LENGTH; j++) {
                var current_letter = ANSWERS[i][j];
                var colorCode = "";
                var indicators = [];

                switch (board[i][j]) {
                    case "G":
                        colorCode = CTRL_A + "K" + CTRL_A + "2"; // Green
                        indicators[0] = "(";
                        indicators[1] = ")";
                        break;
                    case "Y":
                        colorCode = CTRL_A + "K" + CTRL_A + "3"; // Yellow
                        indicators[0] = "!";
                        indicators[1] = "!";
                        break;
                    case "B":
                        colorCode = CTRL_A + "K" + CTRL_A + "7"; // White
                        indicators[0] = " ";
                        indicators[1] = " ";
                        break;
                    default:
                        colorCode = CTRL_A + "N";
                        break;
                }
                
                topRow += colorCode + "   ";
                midRow += colorCode + "" + indicators[0] + current_letter + indicators[1] + "";
                botRow += colorCode + "   ";
            }
        } else {
            // Display empty rows - light shade block, no color coding
            for (j = 0; j < WORD_LENGTH; j++) {
                topRow += "\xb0\xb0\xb0";
                midRow += "\xb0\xb0\xb0";
                botRow += "\xb0\xb0\xb0";
            }
        }

        topRow += CTRL_A + "N";
        midRow += CTRL_A + "N";
        botRow += CTRL_A + "N";
        
        lines.push(topRow);
        lines.push(midRow);
        lines.push(botRow);
    }

    return lines;
}



/**
 * Generates a score board array for the Wordle game.
 * The scoreboard displays rankings, names, win percentages, and max streaks
 * for all recorded players up to the specified number of rows.
 * 
 * @param {number} rows - The total number of rows desired in the scoreboard display.
 * @returns {string[]} An array of strings, where each string is a formatted row of score data.
 */
function generate_scoreboard(rows) {
    // scoreboard can be "rows" tall, will always be 40 columns
    var stats = loadStats();

    var RANK_W = 4;
    var NAME_W = 9;
    var PCT_W = 4;
    var MAX_STREAK_W = 10;
    
    var lines = [];

    // Convert stats object into a sortable array
    var entries = [];
    var alias;
    for (alias in stats) {
        if (stats.hasOwnProperty(alias)) {
            var s = stats[alias];
            var totalGames = s.wins + s.losses;
            var winPct = (totalGames > 0) ? Math.round((s.wins / totalGames) * 100) : 0;
            entries.push({
                alias: alias,
                winPct: winPct,
                streak: s.streak,
                maxStreak: s.maxStreak
            });
        }
    }

    // Sort descending by win percentage
    entries.sort(function(a, b) {
        return b.winPct - a.winPct;
    });

    

    // Helper to build a horizontal border segment
    function borderLine(left, mid, right) {
        var line = left;
        line += repeatChar("\xc4", RANK_W + 2);
        line += mid;
        line += repeatChar("\xc4", NAME_W + 2);
        line += mid;
        line += repeatChar("\xc4", PCT_W + 2);
        line += mid;
        line += repeatChar("\xc4", MAX_STREAK_W + 2);
        line += right;
        return line;
    }

    // Helper to build one row's worth of cells, given raw display values
    function buildRow(rankStr, nameStr, pctStr, maxStreakStr) {
        return "\xb3 " + padRight(rankStr, RANK_W) + " \xb3 " +
                padRight(nameStr, NAME_W) + " \xb3 " +
                padLeft(pctStr, PCT_W) + " \xb3 " +
                padLeft(maxStreakStr, MAX_STREAK_W) + " \xb3";
    }

    // Top border
    lines.push(borderLine("\xda", "\xc4", "\xbf"));

    // Title bar (spans full width as plain text, no column separators)
    lines.push("\xb3" + CTRL_A + "N" + CTRL_A + "H" + centerText("Top "+ rows +" Wordle Players", 38) + CTRL_A + "N" + "\xb3");

    // Separator under title
    lines.push(borderLine("\xc3", "\xc2", "\xb4"));

    // Header row
    lines.push(buildRow("Rank", "Name", "Win%", "Max Streak"));

    // Header separator
    lines.push(borderLine("\xc3", "\xc5", "\xb4"));

    // Data rows - pad out to `rows` height even if fewer players exist
    var i;
    for (var i = 0; i < rows; i++) {
        if (i < entries.length) {
            var entry = entries[i];
            lines.push(buildRow(
                "" + (i + 1),
                entry.alias,
                entry.winPct + "%",
                "" + entry.maxStreak
            ));
        } else {
            lines.push(buildRow("", "", "", ""));
        }
    }

    // Bottom border
    lines.push(borderLine("\xc0", "\xc1", "\xd9"));

    return lines;
}







/////////////////////////////////////////////
// "Big Boy" Functions
//
// Large functions that drive the gameplay.
/////////////////////////////////////////////

/**
 * Runs the core Wordle gameplay logic.
 * Sets up the board, handles user input (guesses), checks results against the daily/selected word,
 * and updates player stats if in 'daily' mode.
 * 
 * @param {string} game_mode - The current game mode ("daily" or "practice").
 */
function playWordle(game_mode) {
    var ANSWERS = [];
    var stats = loadStats();

    var word = "";
    
    if (game_mode === "daily") {
        if (!check_player_can_play(stats)) {
            smartPrint("You've already played today!" + NEWLINE);
            smartPrint("You can try practice mode though!" + NEWLINE); 
            return;
        }
        else {
            word = getDailyWord();
        }
    }
    else if (game_mode === "practice") {
        word = WORDS[Math.floor(Math.random() * WORDS.length)];
    }


    // Initialize game state variables
    var board = makeEmptyBoard();
    var currentRow = 0;
    var gameOver = false; 
    var board_lines = [];

    // Set up legend lines for the UI
    var legend_lines = [];
    legend_lines.push(CTRL_A + "K" + CTRL_A + "2" + "(X)" + CTRL_A + "N" + " = Correct");
    legend_lines.push("");
    legend_lines.push(CTRL_A + "K" + CTRL_A + "3" + "!X!" + CTRL_A + "N" + " = Misplaced");
    legend_lines.push("");
    legend_lines.push(CTRL_A + "K" + CTRL_A + "7" + " X " + CTRL_A + "N" + " = Not in word");



    // Main game loop: runs until the player wins or reaches MAX_ATTEMPTS
    while (!gameOver && currentRow < MAX_ATTEMPTS) {
        console.clear()
        smartPrint(NEWLINE);
        // Display current board state and legend
        board_lines = generateBoard(board, currentRow, ANSWERS);
        for (var i = 0; i < board_lines.length; i++) {
            if (legend_lines[i]) {
                smartPrint(" " + board_lines[i] + " " + legend_lines[i] + NEWLINE);
            }
            else {
                smartPrint(" " + board_lines[i] + NEWLINE);
            }
        }
        smartPrint(NEWLINE);

        var guess = "";
        smartPrint("Enter your " + WORD_LENGTH + "-letter guess: ");
        // Get and validate user input for the current guess
        while (guess.length !== WORD_LENGTH) {
            guess = console.getstr(WORD_LENGTH, K_UPPER);
            if (guess === null) {
                guess = ""; // user disconnected or aborted input
            }
            if (guess.length !== WORD_LENGTH) {
                guess = "";
                smartPrint("Please enter exactly " + WORD_LENGTH + " letters." + NEWLINE);
            }
            else if (guess.indexOf(" ") !== -1) {
                guess = "";
                smartPrint("Guess cannot include spaces." + NEWLINE);
            }
            else if (VALID_WORDS.indexOf(guess) === -1) {
                guess = "";
                smartPrint("Guess must be a real word." + NEWLINE);
            }
        }
        ANSWERS.push(guess);

        // Check if the guess is correct and update the board state
        var result = checkGuess(guess, word);
        board[currentRow] = result;

        // Check for win condition (all green)
        var allGreen = true;
        var i;
        for (var i = 0; i < result.length; i++) {
            if (result[i] !== "G") {
                allGreen = false;
                break;
            }
        }

        currentRow++;

        if (allGreen) {
            console.clear();
            smartPrint("Winner! You guessed the word: " + word + NEWLINE);
            gameOver = true;
        }
    } 

    // Display final board state after the game ends
    if (!gameOver) {
        console.clear();
        smartPrint("Game over! The word was: " + word + NEWLINE);
    }

    smartPrint(NEWLINE);
    board_lines = generateBoard(board, currentRow, ANSWERS);
    for (var i = 0; i < board_lines.length; i++) {
        if (legend_lines[i]) {
            smartPrint(" " + board_lines[i] + " " + legend_lines[i] + NEWLINE);
        }
        else {
            smartPrint(" " + board_lines[i] + NEWLINE);
        }
    }
   

    // Save statistics if the game was in daily mode
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

        // Update win/loss statistics and streak
        if(gameOver) {
            // Player won
            stats[user.alias].wins++;
            // current streak calculation
            if (check_if_streak_valid(last_date_played)) {
                stats[user.alias].streak++;
            }
            else {
                stats[user.alias].streak = 1;
            }

            // check if current streak is new max streak
            if (stats[user.alias].streak > stats[user.alias].maxStreak) {
                stats[user.alias].maxStreak = stats[user.alias].streak;
            }
        }
        else {
            // Player lost
            stats[user.alias].losses++;
            stats[user.alias].streak = 0;
        }

        saveStats(stats);
    }

}



/**
 * Initializes the main game loop and displays the wordle menu.
 * This function acts as the entry point for the entire application.
 * It loops until the user explicitly quits (chooses 'Q').
 */
function startWordle() {
    // Tracks the user's selection choice to control the main menu loop.
    var choice = "";
    while (choice !== "Q") {
        console.clear();

        // 1. Display Banner and Intro Card based on terminal width.
        if (console.screen_columns === 40) {
	        // Use dedicated banner for smaller console size.
            if (!console.term_supports(USER_ANSI) && !console.term_supports(USER_PETSCII)) {
                console.printfile(js.exec_dir + "banner.40col.ascii.msg"); // 6 Rows
            }
            else {
                console.printfile(js.exec_dir + "banner.40col.msg"); // 6 Rows
            }
	        

            var intro_page_lines = generate_intro_card();
            // Print individual lines of the intro card.
            for (var i = 0; i < intro_page_lines.length; i++) {
                smartPrint(intro_page_lines[i] + NEWLINE, p_mode=P_NOPAUSE);
            }
            
            
            smartPrint(NEWLINE, p_mode=P_NOPAUSE);
            smartPrint(NEWLINE, p_mode=P_NOPAUSE);
            smartPrint(NEWLINE, p_mode=P_NOPAUSE);
            smartPrint(NEWLINE, p_mode=P_NOPAUSE);
            smartPrint(NEWLINE, p_mode=P_NOPAUSE);
        }
        else {
            // Use general banner for larger console size.
            if (!console.term_supports(USER_ANSI) && !console.term_supports(USER_PETSCII)) {
                console.printfile(js.exec_dir + "banner.ascii.msg"); // 13 Rows
            }
            else {
                console.printfile(js.exec_dir + "banner.msg"); // 13 Rows
            }
            var intro_page_lines = generate_intro_card();
            // Generate scoreboard lines (first 5 entries) for the main menu.
            // A dedicated larger scoreboard can still be accessed with S.
            var scoreboard_lines = generate_scoreboard(5, console.screen_columns);
            smartPrint(NEWLINE, p_mode=P_NOPAUSE);

            // Display intro card and scoreboard side-by-side.
            for (var i = 0; i < scoreboard_lines.length; i++) {
                if(intro_page_lines[i]) {
                    smartPrint(intro_page_lines[i] + scoreboard_lines[i] + NEWLINE, p_mode=P_NOPAUSE);
                }
                else {
                    // No more intro lines, pad the area with empty spaces so the scoreboard lines up.
                    smartPrint(centerText("",40) + scoreboard_lines[i] + NEWLINE, p_mode=P_NOPAUSE);
                }
                
            }
            
        }

        // 2. Display Menu Prompt and Get User Choice.
        smartPrint("[D]aily [P]ractice [S]core [Q]uit > ", p_mode=P_NOPAUSE);
        choice = console.getstr(1, K_UPPER);

        // 3. Handle User Choices.
        if (choice === "D"){
            playWordle("daily");
        }
        else if (choice === "P") {
            playWordle("practice");
        }
        else if (choice === "S") {
            // Display full scoreboard with 15 entries.
            console.clear();
            var scoreboard_lines = generate_scoreboard(15, smartPrint);
            for (var i = 0; i < scoreboard_lines.length; i++) {
                smartPrint(scoreboard_lines[i] + NEWLINE, p_mode=P_NOPAUSE);
            }
        }
    }
}







////////////////////////////
// Main()
// 
// Starts the Game
////////////////////////////

startWordle();
