import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

function App() {
  const [userInput, setUserInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const chatContainerRef = useRef(null);
  const recognitionRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const debounceTimeoutRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    chatContainerRef.current?.scrollTo(0, chatContainerRef.current.scrollHeight);
  }, [chatHistory, isTyping]);

  // Fetch product suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (userInput.trim()) {
        try {
          const response = await axios.get("http://localhost:8000/products", {
            params: { query: userInput },
          });
          setSuggestions(response.data.products.slice(0, 3));
        } catch (error) {
          console.error("Error fetching suggestions:", error);
        }
      } else {
        setSuggestions([]);
      }
    };
    fetchSuggestions();
  }, [userInput]);

  // Voice input setup
  useEffect(() => {
    if ("webkitSpeechRecognition" in window) {
      recognitionRef.current = new window.webkitSpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Debounce input updates
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = setTimeout(() => {
          setUserInput(finalTranscript || interimTranscript);
        }, 200);

        // Reset silence detection
        clearTimeout(silenceTimeoutRef.current);
        if (finalTranscript) {
          silenceTimeoutRef.current = setTimeout(() => {
            recognitionRef.current.stop();
            if (finalTranscript.trim()) {
              handleSend();
            }
          }, 1000); // Auto-submit after 1 second of silence
        }
      };

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        setChatHistory((prev) => [
          ...prev,
          { sender: "bot", text: "Sorry, I couldn't understand. Please try again." },
        ]);
      };
    }

    // Cleanup on component unmount
    return () => {
      recognitionRef.current?.stop();
      clearTimeout(silenceTimeoutRef.current);
      clearTimeout(debounceTimeoutRef.current);
    };
  }, []);

  const startVoiceInput = () => {
    if (!recognitionRef.current) {
      setChatHistory((prev) => [
        ...prev,
        { sender: "bot", text: "Voice input is not supported in this browser." },
      ]);
      return;
    }
    if (!isListening) {
      recognitionRef.current.start();
    }
  };

  const handleSend = async () => {
    if (!userInput.trim()) return;

    // Add user message to chat history
    setChatHistory((prev) => [...prev, { sender: "user", text: userInput }]);
    setIsTyping(true);
    setUserInput("");

    try {
      const response = await axios.post(
        "http://localhost:8000/chat",
        { query: userInput },
        { headers: { "Content-Type": "application/json" } }
      );

      const { response: botResponse, images } = response.data;
      console.log("Received images:", images); // Debug log
      // Deduplicate images based on id
      const uniqueImages = Array.from(
        new Map(images.map((img) => [img.id, img])).values()
      );
      setChatHistory((prev) => [
        ...prev,
        { sender: "bot", text: botResponse, images: uniqueImages },
      ]);
    } catch (error) {
      console.error("Error in handleSend:", error);
      setChatHistory((prev) => [
        ...prev,
        { sender: "bot", text: "Oops! Something went wrong. Try again." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Carousel settings
  const sliderSettings = (imageCount) => ({
    dots: imageCount > 1,
    infinite: imageCount > 1,
    speed: 500,
    slidesToShow: Math.min(imageCount, 2),
    slidesToScroll: 1,
    responsive: [
      { breakpoint: 640, settings: { slidesToShow: 1 } },
    ],
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-100 to-blue-100 p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl bg-white shadow-2xl rounded-2xl p-8 flex flex-col h-[85vh]"
      >
        <h1 className="text-4xl font-extrabold text-center mb-6 text-green-700">
          🛒 Grocery Assistant
        </h1>

        {/* Chat Area */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto mb-6 space-y-6 p-4 bg-gray-50 rounded-lg"
        >
          <AnimatePresence>
            {chatHistory.map((chat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex ${chat.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`px-5 py-3 rounded-2xl max-w-md ${
                    chat.sender === "user"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  <strong>{chat.sender === "user" ? "You" : "Assistant"}:</strong>
                  <div className="mt-1">
                    <ReactMarkdown>{chat.text}</ReactMarkdown>
                  </div>
                  {chat.images?.length > 0 && (
                    <Slider {...sliderSettings(chat.images.length)} className="mt-4">
                      {chat.images.map((img) => (
                        <div key={img.id} className="px-2">
                          <div className="bg-white border rounded-lg p-3 shadow-lg">
                            <img
                              src={`data:image/jpeg;base64,${img.image_base64}`}
                              alt={img.product_name}
                              className="rounded-lg object-cover w-full h-40"
                              onError={(e) =>
                                (e.target.src = "https://via.placeholder.com/150?text=Image+Not+Found")
                              }
                            />
                            <div className="text-center mt-2">
                              <p className="font-semibold">{img.product_name}</p>
                              <p className="text-green-600 font-bold">Rs. {img.price}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </Slider>
                  )}
                </div>
              </motion.div>
            ))}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-gray-200 text-gray-800 px-5 py-3 rounded-2xl max-w-xs">
                  <div className="flex space-x-2">
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100"></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200"></span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="flex space-x-2 mb-4">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setUserInput(suggestion)}
                className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm hover:bg-green-200"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Input Box */}
        <div className="flex space-x-3">
          <input
            type="text"
            placeholder="Ask about groceries..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 border border-gray-300 rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-green-400"
            aria-label="Type your message"
            disabled={isListening}
          />
          <button
            onClick={startVoiceInput}
            className={`${
              isListening ? "bg-red-500" : "bg-blue-500"
            } text-white rounded-full p-3 hover:${
              isListening ? "bg-red-600" : "bg-blue-600"
            } transition`}
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
          >
            {isListening ? "🛑" : "🎙️"}
          </button>
          <button
            onClick={handleSend}
            className="bg-green-500 text-white rounded-full px-6 py-3 font-semibold hover:bg-green-600 transition"
            aria-label="Send message"
            disabled={isListening}
          >
            Send
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default App;