from transformers import BertForTokenClassification, BertTokenizerFast
import torch
import sys
import json

def extract_entities(text):
    # Load the saved model
    model_directory = "saved_model"
    model = BertForTokenClassification.from_pretrained(model_directory)

    # Load the saved tokenizer
    tokenizer_directory = "saved_tokenizer"
    tokenizer = BertTokenizerFast.from_pretrained(tokenizer_directory)

    # Tokenize the text
    tokenized_input = tokenizer(text, return_tensors="pt", truncation=True, padding=True)

    # Make predictions
    with torch.no_grad():
        outputs = model(**tokenized_input)

    predictions = torch.argmax(outputs.logits, dim=-1)

    # Decode predictions
    label_map = {0: "O", 1: "DISEASE", 2: "MEDICATION"}
    pred_labels = [label_map[label_id] for label_id in predictions[0].tolist()]
    tokens = tokenizer.convert_ids_to_tokens(tokenized_input.input_ids[0])

    # Initialize variables to store detected diseases and medications
    diseases = []
    medications = []
    current_entity = None
    current_text = ""

    # Reconstruct original words from subword tokens
    word_tokens = []
    word_labels = []
    for token, label in zip(tokens, pred_labels):
        if token.startswith("##"):
            word_tokens[-1] = word_tokens[-1] + token[2:]
        else:
            word_tokens.append(token)
            word_labels.append(label)

    # Extract diseases and medications
    for token, label in zip(word_tokens, word_labels):
        if label == "DISEASE":
            diseases.append(token)
        elif label == "MEDICATION":
            medications.append(token)

    # Return results as JSON
    result = {
        "diseases": diseases
    }
    return json.dumps(result)

if __name__ == "__main__":
    text = sys.argv[1]
    result = extract_entities(text)
    print(result)
