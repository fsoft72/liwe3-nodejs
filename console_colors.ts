export const colors = {
	Reset: "\x1b[0m",
	Bright: "\x1b[1m",
	Dim: "\x1b[2m",
	Underscore: "\x1b[4m",
	Blink: "\x1b[5m",
	Reverse: "\x1b[7m",
	Hidden: "\x1b[8m",

	Black: "\x1b[30m",
	Red: "\x1b[31m",
	Green: "\x1b[32m",
	Yellow: "\x1b[33m",
	Blue: "\x1b[34m",
	Magenta: "\x1b[35m",
	Cyan: "\x1b[36m",
	White: "\x1b[37m",

	bg_Black: "\x1b[40m",
	bg_Red: "\x1b[41m",
	bg_Green: "\x1b[42m",
	bg_Yellow: "\x1b[43m",
	bg_Blue: "\x1b[44m",
	bg_Magenta: "\x1b[45m",
	bg_Cyan: "\x1b[46m",
	bg_White: "\x1b[47m",
};

export const warn = ( ...args: any ) => {
	console.warn( colors.Yellow + "*** WARN:" + colors.Reset, ...args );
};

export const info = ( ...args: any ) => {
	console.log( colors.White + colors.bg_Blue + "INFO:" + colors.Reset, ...args );
};;