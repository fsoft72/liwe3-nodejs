export const colors = {
	Reset: "\x1b[0m",
	Bright: "\x1b[1m",
	Dim: "\x1b[2m",
	Underline: "\x1b[4m",
	BlinkSlow: "\x1b[5m",
	BlinkFast: "\x1b[6m",
	Reverse: "\x1b[7m",
	Hidden: "\x1b[8m",
	Crossed: "\x1b[9m",

	FontDefault: "\x1b[10m",
	FontAlt1: "\x1b[11m",
	FontAlt2: "\x1b[12m",
	FontAlt3: "\x1b[13m",
	FontAlt4: "\x1b[14m",
	FontAlt5: "\x1b[15m",
	FontAlt6: "\x1b[16m",
	FontAlt7: "\x1b[17m",
	FontAlt8: "\x1b[18m",

	Bold: "\x1b[21m",
	FontNormal: "\x1b[22m",

	Black: "\x1b[30m",
	Red: "\x1b[31m",
	Green: "\x1b[32m",
	Yellow: "\x1b[33m",
	Blue: "\x1b[34m",
	Magenta: "\x1b[35m",
	Cyan: "\x1b[36m",
	White: "\x1b[37m",

	BlackBright: "\x1b[90m",
	RedBright: "\x1b[91m",
	GreenBright: "\x1b[92m",
	YellowBright: "\x1b[93m",
	BlueBright: "\x1b[94m",
	MagentaBright: "\x1b[95m",
	CyanBright: "\x1b[96m",
	WhiteBright: "\x1b[97m",

	bg_Black: "\x1b[40m",
	bg_Red: "\x1b[41m",
	bg_Green: "\x1b[42m",
	bg_Yellow: "\x1b[43m",
	bg_Blue: "\x1b[44m",
	bg_Magenta: "\x1b[45m",
	bg_Cyan: "\x1b[46m",
	bg_White: "\x1b[47m",
};

/**
 * Logs a warning message to the console.
 * The message is prefixed with a yellow WARN label in magenta background.
 *
 * @param {...any} args - The arguments to log to the console.
 * @returns {void}
 */
export const warn = ( ...args: any ) => {
	console.warn( colors.Magenta + colors.bg_Yellow + "  WARN  " + colors.Reset, ...args );
};

/**
 * Logs an info message to the console.
 * The message is prefixed with a blue INFO label in cyan background.
 *  
 * @param {...any} args - The arguments to log to the console.
 */
export const info = ( ...args: any ) => {
	console.log( colors.White + colors.bg_Blue + "  INFO  " + colors.Reset, ...args );
};

/**
 * Logs an error message to the console.
 * The message is prefixed with a red ERR label in white background.
 * 
 * @param {...any} args - The arguments to log to the console.
 */
export const error = ( ...args: any ) => {
	console.log( colors.White + colors.bg_Red + "  ERR   " + colors.Reset, ...args );
};

/**
 * Logs a critical error message to the console.
 * The message is completely written in white on red background.
 * 
 * @param {...any} args - The arguments to log to the console.
 */
export const critical = ( ...args: any ) => {
	console.error( colors.White + colors.bg_Red, ...args, colors.Reset );
};