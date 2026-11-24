/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				brand: {
					50: "#f1f5f9",
					500: "#214b75",
					600: "#12375f",
					700: "#0b2949",
				},
			},
		},
	},
	plugins: [],
};
