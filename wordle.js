// Simple text-based Wordle game for Synchronet BBSes
// Supports 40-column and 80-column modes
// Rewritten for compatibility with older Synchronet JS engine (no ES6 features)
load("sbbsdefs.js")



/////////////////////////////////////////
// Defaults
//
// Generally shouldn't need to be changed
/////////////////////////////////////////
var MAX_ATTEMPTS = 6;
var WORD_LENGTH = 5;
var STATS_FILE = system.data_dir + "wordle_stats.json"
// Load word list from file
var WORDS = [];
var word_file = new File(js.exec_dir + "word-bank.csv");
if (word_file.open("r")) {
    WORDS = word_file.readAll();
    word_file.close();
}







/////////////////////////////////////////
// Helper Functions
//
// Small functions that do little tasks
/////////////////////////////////////////


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

function getDailyWord() {
    var today = get_todays_date().split("-");
    var date = new Date(parseInt(today[0]), parseInt(today[1]) - 1, parseInt(today[2]));
    var epoch = new Date(2020, 0, 1);
    var msPerDay = 24 * 60 * 60 * 1000;
    var seed = Math.round((date - epoch) / msPerDay);
    var index = seed % WORDS.length;
    return WORDS[index].toUpperCase();
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

// Helper to pad a string to fixed width, left-aligned
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

// Helper to pad a string to fixed width, right-aligned
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

function repeatChar(ch, count) {
    var out = "";
    var i;
    for (i = 0; i < count; i++) {
        out += ch;
    }
    return out;
}

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

function visibleLength(str) {
    return str.replace(/\x01./g, "").length;
}

function generate_intro_card(){
    var intro_page_lines = [];
    intro_page_lines.push(centerText("",40));
    intro_page_lines.push(centerText("Welcome to Wordle!",40));
    intro_page_lines.push(centerText("Guess the " + WORD_LENGTH + "-letter word in " + MAX_ATTEMPTS + " tries.", 40));

    return intro_page_lines;
}




////////////////////////////////////////////////////
// "Big Boy" Functions
//
// These are main functions, such as the main menu,
//    Gameplay, etc.
////////////////////////////////////////////////////

// Function to display the game board
function generateBoard(board, currentRow, ANSWERS) {
    var CTRL_A = "\x01";
    var columns = 40;
    var lines = [];
    var i, j;

    for (i = 0; i < MAX_ATTEMPTS; i++) {
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

// Playing the Game
function playWordle(mode, game_mode) {
    var ANSWERS = [];
    var stats = loadStats();

    var word = "";
    
    if (game_mode === "daily") {
        if (!check_player_can_play(stats)) {
            console.putmsg("You've already played today!\n");
            console.putmsg("You can try practice mode though!\n"); 
            return;
        }
        else {
            word = getDailyWord();
            // console.putmsg(word + "\n");
        }
    }
    else if (game_mode === "practice") {
        word = WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
    }
    var board = makeEmptyBoard();
    var currentRow = 0;
    var gameOver = false; 
    var board_lines = [];

    var legend_lines = [];
    legend_lines.push(CTRL_A + "K" + CTRL_A + "2" + "(X)" + CTRL_A + "N" + " = Correct");
    legend_lines.push("");
    legend_lines.push(CTRL_A + "K" + CTRL_A + "3" + "!X!" + CTRL_A + "N" + " = Misplaced");
    legend_lines.push("");
    legend_lines.push(CTRL_A + "K" + CTRL_A + "7" + " X " + CTRL_A + "N" + " = Not in word");

    while (!gameOver && currentRow < MAX_ATTEMPTS) {
        console.clear()
        console.putmsg("\n");
        board_lines = generateBoard(board, currentRow, ANSWERS);
        for (i = 0; i < board_lines.length; i++) {
            if (legend_lines[i]) {
                console.putmsg(" "+board_lines[i]+" "+legend_lines[i]+"\n");
            }
            else {
                console.putmsg(" "+board_lines[i]+"\n");
            }
        }
        console.putmsg("\n");

        var guess = "";
        while (guess.length !== WORD_LENGTH) {
            console.putmsg("Enter your " + WORD_LENGTH + "-letter guess: ");
            guess = console.getstr(WORD_LENGTH, K_UPPER);
            if (guess === null) {
                guess = ""; // user disconnected or aborted input
            }

            if (guess.length !== WORD_LENGTH) {
                console.putmsg("Please enter exactly " + WORD_LENGTH + " letters.\n");
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
            console.clear();
            console.putmsg("Winner! You guessed the word: " + word + "\n");
            gameOver = true;
        }
    }

    if (!gameOver) {
        console.clear();
        console.putmsg("Game over! The word was: " + word + "\n");
    }

    console.putmsg("\n");
    board_lines = generateBoard(board, currentRow, ANSWERS);
    for (i = 0; i < board_lines.length; i++) {
        if (legend_lines[i]) {
            console.putmsg(" "+board_lines[i]+" "+legend_lines[i]+"\n");
        }
        else {
            console.putmsg(" "+board_lines[i]+"\n");
        }
    }
   

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

function generate_scoreboard(rows) {
    // scoreboard can be "rows" tall, will always be 40 columns
    var stats = loadStats();
    var CTRL_A = "\x01";

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
    for (i = 0; i < rows; i++) {
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

function startWordle(mode) {
    // Mainly responsible for the Main Menu, but is also the entry point of the game.
    // Takes in a "mode" that represents whether the user playing is using a 40 or 80 column display. 
    var choice = "";
    while (choice !== "Q") {
        console.clear();
        if (mode === "40") {
	        console.printfile(js.exec_dir + "banner.40col.msg"); // 6 Rows
            var intro_page_lines = generate_intro_card();
            for (i = 0; i < intro_page_lines.length; i++) {
                console.putmsg(intro_page_lines[i], p_mode=P_NOPAUSE);
            }
            
            console.putmsg("\n", p_mode=P_NOPAUSE);
        }
        else {
            console.printfile(js.exec_dir + "banner.msg"); // 13 Rows
            var intro_page_lines = [];
            intro_page_lines.push(centerText("",40));
            intro_page_lines.push(centerText("Welcome to Wordle!",40));
            intro_page_lines.push(centerText("Guess the " + WORD_LENGTH + "-letter word in " + MAX_ATTEMPTS + " tries.", 40));
            intro_page_lines.push("");
            intro_page_lines.push("");
            intro_page_lines.push(" " + CTRL_A + "K" + CTRL_A + "2" + "(X)" + CTRL_A + "N" + " = Correct");
            intro_page_lines.push("");
            intro_page_lines.push(" " + CTRL_A + "K" + CTRL_A + "3" + "!X!" + CTRL_A + "N" + " = Misplaced");
            intro_page_lines.push("");
            intro_page_lines.push(" " + CTRL_A + "K" + CTRL_A + "7" + " X " + CTRL_A + "N" + " = Not in word");
            var scoreboard_lines = generate_scoreboard(5, mode);
            console.putmsg("\n", p_mode=P_NOPAUSE);
            for (i = 0; i < scoreboard_lines.length; i++) {
                if(intro_page_lines[i]) {
                    console.putmsg(intro_page_lines[i]+scoreboard_lines[i], p_mode=P_NOPAUSE);
                }
                else {
                    console.putmsg(centerText("",40)+scoreboard_lines[i], p_mode=P_NOPAUSE);
                }
                
            }
            
        }

        
        console.putmsg("[D]aily [P]ractice [S]core [Q]uit > ", p_mode=P_NOPAUSE);
        choice = console.getstr(1, K_UPPER);

        if (choice === "D"){
            playWordle(mode, "daily");
        }
        else if (choice === "P") {
            playWordle(mode, "practice");
        }
        else if (choice === "S") {
            console.clear();
            var scoreboard_lines = generate_scoreboard(15, mode);
            for (i = 0; i < scoreboard_lines.length; i++) {
                console.putmsg(scoreboard_lines[i], p_mode=P_NOPAUSE);
            }
        }
    }
}







////////////////////////////
// Main()
// 
// Starts the Game
////////////////////////////

var mode = getScreenMode();
startWordle(mode);
