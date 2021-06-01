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

export const warn = ( ...args: any ) => {
	console.warn( colors.Magenta + colors.bg_Yellow + "  WARN  " + colors.Reset, ...args );
};

export const info = ( ...args: any ) => {
	console.log( colors.White + colors.bg_Blue + "  INFO  " + colors.Reset, ...args );
};

export const critical = ( ...args: any ) => {
	console.error( colors.White + colors.bg_Red, ...args, colors.Reset );
};