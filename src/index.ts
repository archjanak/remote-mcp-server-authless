import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Authless Assistant",
		version: "1.0.0",
	});

	async init() {
		// Simple addition tool
		this.server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
			content: [{ type: "text", text: String(a + b) }],
		}));

		// Calculator tool with multiple operations
		this.server.tool(
			"calculate",
			{
				operation: z.enum(["add", "subtract", "multiply", "divide"]),
				a: z.number(),
				b: z.number(),
			},
			async ({ operation, a, b }) => {
				let result: number;
				switch (operation) {
					case "add":
						result = a + b;
						break;
					case "subtract":
						result = a - b;
						break;
					case "multiply":
						result = a * b;
						break;
					case "divide":
						if (b === 0)
							return {
								content: [
									{
										type: "text",
										text: "Error: Cannot divide by zero",
									},
								],
							};
						result = a / b;
						break;
				}
				return { content: [{ type: "text", text: String(result) }] };
			},
		);

		// Weather tool using Open Meteo API
		this.server.tool(
    'get-weather',
    'Tool to get current weather information for a given city',
    {
        city: z.string().describe("Name of the city to get weather information for"),
    },
    async ({city}) => {
        //get coordinates for the city from Open Meteo Geocoding API  
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=10&language=en&format=json`);
        const data = await response.json();
        
        //get the first result from the geocoding API
        const {latitude, longitude} = data.results[0];

       // Check if city is found and latitude and longitude are available
        if (!latitude || !longitude) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Could not find coordinates for the city: ${city}. Please try another city.`
                    }
                ]
            };
        }
        // Fetch weather data using Open Meteo API
        
        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,rain&models=gfs_seamless&current=temperature_2m,relative_humidity_2m,is_day,precipitation,rain,showers,cloud_cover,weather_code,snowfall,wind_speed_10m,wind_direction_10m,wind_gusts_10m&temperature_unit=fahrenheit`);
        const weatherData = await weatherResponse.json();
        const currentWeather = weatherData.current;
        const weatherCode = currentWeather.weather_code;
        const weatherCondition = getWeatherCondition(weatherCode);

        return {    
            content: [
                {
                    type: "text",
                    text: JSON.stringify(weatherData, null, 2)
                    //text: `Current weather in ${city}:\nTemperature: ${currentWeather.temperature_2m}°F\n${weatherCondition}\nHumidity: ${currentWeather.relative_humidity_2m}%\nWind Speed: ${currentWeather.wind_speed_10m} km/h ${currentWeather.wind_direction_10m}\nCondition: ${currentWeather.is_day ? 'Day' : 'Night'}`
                }
            ]
        };
    } 
);

function getWeatherCondition(code: number): string {
    switch (code) {
        case 0: return "Clear sky";
        case 1: 
        case 2:
        case 3: return "Mainly clear, partly cloudy, and overcast";
        case 45:
        case 48: return "Fog and depositing rime fog";
        case 51:
        case 53:
        case 55: return "Drizzle: Light, moderate, and dense intensity";
        case 56:
        case 57: return "Freezing Drizzle: Light and dense intensity";
        case 61:
        case 63:
        case 65: return "Rain: Slight, moderate and heavy intensity";
        case 66:
        case 67: return "Freezing Rain: Light and heavy intensity";    
        case 71:
        case 73:
        case 75: return "Snow fall: Slight, moderate, and heavy intensity";
        case 77: return "Snow grains";     
        case 80:
        case 81:
        case 82: return "Rain showers: Slight, moderate, and violent";
        case 85:
        case 86: return "Snow showers slight and heavy"; 
        case 95: return "Thunderstorm: Slight or moderate";
        case 96:
        case 99: return "Thunderstorm with slight and heavy hail";
        default: return "Unknown";
    }
};

	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
