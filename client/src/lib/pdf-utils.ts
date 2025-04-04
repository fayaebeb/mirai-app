import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Message } from "@shared/schema";
import MarkdownIt from "markdown-it";

type PDFGenerationOptions = {
  title?: string;
  author?: string;
  includeTimestamp?: boolean;
  theme?: "light" | "dark";
  quality?: number;
};

// Initialize markdown parser
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true
});

/**
 * Creates an HTML representation of the chat conversation with proper markdown support
 * Optimized for Japanese characters and smaller file size
 */
function createChatHTML(
  messages: Message[], 
  options: PDFGenerationOptions
): HTMLElement {
  const { 
    title = "チャットの会話", 
    includeTimestamp = true,
    theme = "light",
  } = options;
  
  // Base styles for dark/light themes
  const themeStyles = theme === 'light' 
    ? {
        bgColor: '#FFFFFF',
        textColor: '#1A1A1A',
        headerColor: '#333333',
        timestampColor: '#666666',
        botBubbleBg: '#F0F4F8',
        userBubbleBg: '#E3F2FD',
        botNameColor: '#3B82F6',
        userNameColor: '#8B5CF6',
        borderColor: '#E2E8F0'
      }
    : {
        bgColor: '#1A202C',
        textColor: '#E2E8F0',
        headerColor: '#E2E8F0',
        timestampColor: '#A0AEC0',
        botBubbleBg: '#2D3748',
        userBubbleBg: '#1E3A8A',
        botNameColor: '#60A5FA',
        userNameColor: '#A78BFA',
        borderColor: '#4A5568'
      };

  // Create container element with styles
  const container = document.createElement('div');
  container.style.fontFamily = 'sans-serif, Arial, "Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo';
  container.style.width = '100%';
  container.style.maxWidth = '800px';
  container.style.margin = '0 auto';
  container.style.padding = '20px';
  container.style.boxSizing = 'border-box';
  container.style.backgroundColor = themeStyles.bgColor;
  container.style.color = themeStyles.textColor;
  
  // Add header with logo and title
  const headerElement = document.createElement('header');
  headerElement.style.textAlign = 'center';
  headerElement.style.marginBottom = '20px';
  headerElement.style.padding = '10px';
  headerElement.style.borderBottom = `1px solid ${themeStyles.borderColor}`;
  
  // Create title with stylish elements
  const titleElement = document.createElement('h1');
  titleElement.style.fontSize = '24px';
  titleElement.style.color = themeStyles.headerColor;
  titleElement.style.margin = '0 0 5px 0';
  titleElement.style.fontWeight = '600';
  titleElement.style.display = 'flex';
  titleElement.style.alignItems = 'center';
  titleElement.style.justifyContent = 'center';
  titleElement.style.gap = '8px';
  
  // Add a small avatar/icon before the title
  const iconSpan = document.createElement('span');
  iconSpan.innerHTML = '💬';
  iconSpan.style.fontSize = '20px';
  titleElement.appendChild(iconSpan);
  
  const titleTextSpan = document.createElement('span');
  titleTextSpan.textContent = title;
  titleElement.appendChild(titleTextSpan);
  
  headerElement.appendChild(titleElement);
  
  // Add datetime if requested
  if (includeTimestamp) {
    const dateElement = document.createElement('p');
    dateElement.textContent = `Generated on: ${new Date().toLocaleString()}`;
    dateElement.style.textAlign = 'center';
    dateElement.style.margin = '5px 0 0 0';
    dateElement.style.fontSize = '14px';
    dateElement.style.color = themeStyles.timestampColor;
    headerElement.appendChild(dateElement);
  }
  
  container.appendChild(headerElement);

  // Create message container
  const messagesContainer = document.createElement('div');
  messagesContainer.style.display = 'flex';
  messagesContainer.style.flexDirection = 'column';
  messagesContainer.style.gap = '15px';
  
  // Add each message with proper markdown formatting
  messages.forEach((message) => {
    // Message container
    const messageElement = document.createElement('div');
    messageElement.style.display = 'flex';
    messageElement.style.flexDirection = 'column';
    messageElement.style.alignItems = message.isBot ? 'flex-start' : 'flex-end';
    messageElement.style.maxWidth = '100%';
    
    // Message header with sender info
    const messageHeader = document.createElement('div');
    messageHeader.style.display = 'flex';
    messageHeader.style.alignItems = 'center';
    messageHeader.style.gap = '8px';
    messageHeader.style.marginBottom = '4px';
    messageHeader.style.padding = '0 8px';
    
    // Sender avatar/icon
    const avatarElement = document.createElement('div');
    avatarElement.style.width = '24px';
    avatarElement.style.height = '24px';
    avatarElement.style.display = 'flex';
    avatarElement.style.alignItems = 'center';
    avatarElement.style.justifyContent = 'center';
    avatarElement.style.borderRadius = '50%';
    avatarElement.style.backgroundColor = message.isBot ? '#3B82F620' : '#8B5CF620';
    avatarElement.style.color = message.isBot ? themeStyles.botNameColor : themeStyles.userNameColor;
    avatarElement.style.fontSize = '14px';
    avatarElement.innerHTML = message.isBot ? '🤖' : '👤';
    messageHeader.appendChild(avatarElement);
    
    // Sender name
    const senderElement = document.createElement('div');
    senderElement.textContent = message.isBot ? 'ミライ' : 'あなた';
    senderElement.style.fontSize = '14px';
    senderElement.style.fontWeight = 'bold';
    senderElement.style.color = message.isBot ? themeStyles.botNameColor : themeStyles.userNameColor;
    messageHeader.appendChild(senderElement);
    
    // Timestamp if available
    if (message.timestamp && includeTimestamp) {
      const timeElement = document.createElement('div');
      timeElement.textContent = new Date(message.timestamp).toLocaleTimeString();
      timeElement.style.fontSize = '12px';
      timeElement.style.fontStyle = 'italic';
      timeElement.style.color = themeStyles.timestampColor;
      timeElement.style.marginLeft = 'auto';
      messageHeader.appendChild(timeElement);
    }
    
    messageElement.appendChild(messageHeader);
    
    // Message bubble with markdown content
    const bubbleElement = document.createElement('div');
    bubbleElement.style.padding = '10px 15px';
    bubbleElement.style.borderRadius = '12px';
    bubbleElement.style.maxWidth = '85%';
    bubbleElement.style.minWidth = '100px';
    bubbleElement.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
    bubbleElement.style.backgroundColor = message.isBot 
      ? themeStyles.botBubbleBg 
      : themeStyles.userBubbleBg;
    bubbleElement.style.border = `1px solid ${message.isBot 
      ? themeStyles.borderColor 
      : 'rgba(59, 130, 246, 0.3)'}`;
    
    // Parse markdown content and insert as HTML
    bubbleElement.innerHTML = md.render(message.content);
    
    // Add some styling to the markdown-rendered content
    const styleElement = document.createElement('style');
    styleElement.textContent = `
    .message-bubble {
      margin-bottom: 10px;
      page-break-inside: avoid; 
    }

      .message-bubble a { color: #3B82F6; text-decoration: underline; }
      .message-bubble img { max-width: 100%; border-radius: 4px; }
      .message-bubble pre { background-color: ${theme === 'light' ? '#F1F5F9' : '#1E293B'}; padding: 8px; border-radius: 4px; overflow-x: auto; }
      .message-bubble code { font-family: monospace; background-color: ${theme === 'light' ? '#F1F5F9' : '#1E293B'}; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
      .message-bubble blockquote { border-left: 3px solid ${theme === 'light' ? '#CBD5E1' : '#475569'}; margin-left: 0; padding-left: 8px; color: ${theme === 'light' ? '#64748B' : '#94A3B8'}; }
      .message-bubble table { border-collapse: collapse; width: 100%; }
      .message-bubble th, .message-bubble td { border: 1px solid ${theme === 'light' ? '#E2E8F0' : '#475569'}; padding: 6px; }
      .message-bubble th { background-color: ${theme === 'light' ? '#F8FAFC' : '#334155'}; }
      .message-bubble ul, .message-bubble ol { padding-left: 20px; }
      .message-bubble p { margin: 0 0 8px 0; }
      .message-bubble p:last-child { margin-bottom: 0; }
    `;
    bubbleElement.classList.add('message-bubble');
    bubbleElement.appendChild(styleElement);
    
    messageElement.appendChild(bubbleElement);
    messagesContainer.appendChild(messageElement);
  });
  
  container.appendChild(messagesContainer);
  
  // Add footer with branding
  const footerElement = document.createElement('footer');
  footerElement.style.marginTop = '30px';
  footerElement.style.padding = '15px 0 0 0';
  footerElement.style.borderTop = `1px solid ${themeStyles.borderColor}`;
  footerElement.style.fontSize = '12px';
  footerElement.style.color = themeStyles.timestampColor;
  footerElement.style.textAlign = 'center';
  footerElement.innerHTML = `<span>ミライ – 会話エクスポート</span>`;
  container.appendChild(footerElement);

  return container;
}

/**
 * Optimized PDF generation with better quality control and compression
 */
export async function generateChatPDF(
  messages: Message[], 
  options: PDFGenerationOptions = {}
): Promise<jsPDF> {
  // Default options
  const finalOptions = {
    ...options,
    quality: options.quality || 1 // Default quality factor (0.5 to 2)
  };
  
  // Create HTML representation
  const chatHTML = createChatHTML(messages, finalOptions);

  // Add to document temporarily
  document.body.appendChild(chatHTML);

  try {
    // Convert HTML to canvas with optimized settings
    const canvas = await html2canvas(chatHTML, {
      scale: finalOptions.quality, // Adjustable quality factor
      useCORS: true,
      logging: false,
      backgroundColor: finalOptions.theme === 'light' ? '#FFFFFF' : '#1A202C',
      imageTimeout: 30000, // Increased timeout for image loading
      onclone: (clonedDoc) => {
        // Ensure proper styling in the cloned document
        const allStyles = document.querySelectorAll('style');
        allStyles.forEach(style => {
          clonedDoc.head.appendChild(style.cloneNode(true));
        });
      }
    });

    // Remove the temporary HTML element
    document.body.removeChild(chatHTML);

    // Create PDF with optimized settings
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true // Enable compression
    });

    // Set document properties
    pdf.setProperties({
      title: options.title || "チャットの会話",
      author: options.author || "ミライ",
      subject: "会話エクスポート",
      creator: "ミライ",
      keywords: "chat, conversation, AI, PDF, export"
    });

    // Optimize the image by converting to JPEG instead of PNG for smaller file size
    // Use lower quality for JPEG to reduce file size while maintaining readability
    const imgData = canvas.toDataURL('image/jpeg', 0.85); 
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pageMargin = 5; // No margins for full-page content

    // Add images to PDF pages with optimized multi-page handling
    let heightLeft = imgHeight;
    let position = 0;
    let page = 1;

    pdf.addImage(imgData, 'JPEG', pageMargin, position, imgWidth - (pageMargin * 2), imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if the content is longer than one page
    while (heightLeft > 0) {
      position = -pageHeight * page;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', pageMargin, position, imgWidth - (pageMargin * 2), imgHeight);
      heightLeft -= pageHeight;
      page++;
    }

    return pdf;
  } catch (error) {
    // Remove the temporary HTML element if an error occurs
    if (document.body.contains(chatHTML)) {
      document.body.removeChild(chatHTML);
    }
    console.error("PDF generation error:", error);
    throw error;
  }
}

/**
 * Exports chat messages to PDF and downloads it with optimized file size
 * 
 * @param messages The chat messages to export
 * @param fileName The name of the PDF file (without extension)
 * @param options PDF generation options
 */
export async function exportChatToPDF(
  messages: Message[],
  fileName: string = "chat-export",
  options: PDFGenerationOptions = {}
): Promise<void> {
  try {
    // Show console info about export
    console.info(`Exporting ${messages.length} messages to PDF`);
    const startTime = performance.now();
    
    // Generate the PDF
    const pdf = await generateChatPDF(messages, options);
    
    // Save with compression enabled
    pdf.save(`${fileName}.pdf`);
    
    // Log performance info
    const endTime = performance.now();
    console.info(`PDF export completed in ${Math.round(endTime - startTime)}ms`);
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    throw error;
  }
}